"""正規化レイヤーから分析用の顧客口座情報を作成するためのGlue PySpark ETLジョブ。
   正規化レイヤーのGlueテーブルを参照し、分析レイヤーのGlueテーブルを作成して、S3にデータを出力する。
   生成したS3データは最新版のみ保持し、古いデータを削除する。
"""

import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.dynamicframe import DynamicFrame
from pyspark.sql.types import DecimalType
from pyspark.sql.functions import *
import boto3

args = getResolvedOptions(
    sys.argv,
    [
        # 以下ジョブ作成時付与されるデフォルトパラメーター
        "target_bucket_name",
        "target_glue_database",
    ],
)

sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
spark.conf.set('spark.sql.broadcastTimeout', '36000')

s3 = boto3.client("s3")
TARGET_BUCKET_NAME = args["target_bucket_name"]
response = s3.list_objects_v2(
    Bucket=TARGET_BUCKET_NAME, Prefix="customerDepositInfo/")
if "Contents" in response:
    for object in response["Contents"]:
        s3.delete_object(Bucket=TARGET_BUCKET_NAME, Key=object["Key"])

# 口座単位（店番号, 科目コード, 口座番号）で勘定日Maxの明細から残高を抽出
df_depositwithdrawhistory = spark.read.table(
    "normalized.depositwithdrawhistory")
df_depositwithdrawhistory = df_depositwithdrawhistory.select(
    "br_num", "acct_code", "account_num", "balance", "trx_timestamp")
df_depositwithdrawhistory = df_depositwithdrawhistory.alias(
    "df_depositwithdrawhistory")

df_max_trx_timestamp = df_depositwithdrawhistory.groupBy(
    "br_num", "acct_code", "account_num"
).agg(max("trx_timestamp").alias("trx_timestamp"))
df_max_trx_timestamp = df_max_trx_timestamp.alias("df_max_trx_timestamp")


df_max_deposts = df_max_trx_timestamp.join(
    df_depositwithdrawhistory, [
        "br_num", "acct_code", "account_num", "trx_timestamp"]
)

df_customeraccount = spark.read.table("normalized.customeraccount")
df_joined_customeraccount = df_max_deposts.join(
    df_customeraccount,
    (df_max_deposts["br_num"] == df_customeraccount["br_num"])
    & (df_max_deposts["acct_code"] == df_customeraccount["acct_code"])
    & (df_max_deposts["account_num"] == df_customeraccount["account_num"]),
    "inner",
)
df_joined_customeraccount = df_joined_customeraccount.persist()

# 総残高
# 総残高…科目毎の合計をCIF単位で総計
# ※業務的に同一科目複数口座を許容する前提（仮）

df_joined_customeraccount = df_joined_customeraccount.withColumn(
    "balance", col("balance").cast(DecimalType(precision=15, scale=0))
)

df_sum_balance_all = df_joined_customeraccount.groupBy(
    "ma_br_num", "ma_acct_code", "ma_account_num"
).agg(sum("balance").alias("sum_balance_all"))
df_sum_balance_all = df_sum_balance_all.alias("df_sum_balance_all")


df_balance_summary = df_joined_customeraccount.groupBy("ma_br_num", "ma_account_num").agg(
    sum("balance").alias("sum_balance_all"),
    sum(when(col("df_max_trx_timestamp.acct_code") == "0001", col("balance"))).alias(
        "sum_balance_ordinary"),
    sum(when(col("df_max_trx_timestamp.acct_code") == "0002", col("balance"))).alias(
        "sum_balance_checking"),
    sum(when(col("df_max_trx_timestamp.acct_code") == "0003", col("balance"))).alias(
        "sum_balance_saving"),
    sum(when(col("df_max_trx_timestamp.acct_code") == "0004", col("balance"))).alias(
        "sum_balance_notice")
)

df_joined_customeraccount = df_joined_customeraccount.join(
    df_balance_summary, ["ma_br_num", "ma_account_num"], "leftouter"
)

df_joined_customeraccount = df_joined_customeraccount.select(
    col("cif_num"),
    col("trx_timestamp").alias("base_date"),
    col("sum_balance_all").cast(DecimalType(precision=12, scale=0)),
    col("sum_balance_ordinary").cast(DecimalType(precision=12, scale=0)),
    col("sum_balance_checking").cast(DecimalType(precision=12, scale=0)),
    col("sum_balance_saving").cast(DecimalType(precision=12, scale=0)),
    col("sum_balance_notice").cast(DecimalType(precision=12, scale=0)),
)

df_max_date = df_joined_customeraccount.groupBy("cif_num").agg(
    max("base_date").alias("base_date")
)
df_max_date.alias("df_max_date")

df_joined_customeraccount = df_max_date.join(
    df_joined_customeraccount, ["cif_num", "base_date"]
).drop("df_max_date.cif_num")

df_joined_customeraccount = df_joined_customeraccount.withColumn(
    "base_date", to_date(col("base_date"))
).distinct()

dyf = DynamicFrame.fromDF(df_joined_customeraccount, glueContext, "towrite")

sink_target = glueContext.getSink(
    path="s3://" + args["target_bucket_name"] + "/" + "customerDepositInfo",
    connection_type="s3",
    updateBehavior="UPDATE_IN_DATABASE",
    partitionKeys=[],
    compression="snappy",
    enableUpdateCatalog=True,
    transformation_ctx="S3bucket_write_raw",
)

sink_target.setCatalogInfo(
    catalogDatabase=args["target_glue_database"], catalogTableName="customerDepositInfo"
)

sink_target.setFormat("glueparquet")

sink_target.writeFrame(dyf)
