"""生の顧客口座データを正規化するためのGlue PySpark ETLジョブ。
   生データレイヤーのGlueテーブルを参照し、標準化レイヤーのGlueテーブルを作成して、S3にデータを出力する。
   生成したS3データは最新版のみ保持し、古いデータを削除する。
"""

import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from pyspark.sql.functions import to_date, reverse
from awsglue.dynamicframe import DynamicFrame
import boto3

args = getResolvedOptions(
    sys.argv,
    [
        # 以下ジョブ作成時付与されるデフォルトパラメーター
        "target_bucket_name",
        "source_glue_database",
        "target_glue_database",
    ],
)

sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session

PREFIX = "CustomerAccount"
# delete old target data
s3 = boto3.client("s3")
TARGET_BUCKET_NAME = args["target_bucket_name"]
response = s3.list_objects_v2(
    Bucket=TARGET_BUCKET_NAME, Prefix=PREFIX + "/")
if "Contents" in response:
    for object in response["Contents"]:
        source_key = object["Key"]
        s3.delete_object(Bucket=TARGET_BUCKET_NAME, Key=source_key)

dyf_c = glueContext.create_dynamic_frame.from_catalog(
    database=args["source_glue_database"],
    table_name="customer",
    transformation_ctx="AWSGlueDataCatalog",
)
dyf_ca = glueContext.create_dynamic_frame.from_catalog(
    database=args["source_glue_database"],
    table_name="customeraccount",
    transformation_ctx="AWSGlueDataCatalog",
)

# Custom Transform
df_c = dyf_c.toDF()
df_ca = dyf_ca.toDF()
df_c = df_c.withColumnRenamed("br_num", "ma_br_num").withColumnRenamed(
    "acct_code", "ma_acct_code").withColumnRenamed("account_num", "ma_account_num")
df = df_c.join(df_ca, ["ma_br_num", "ma_acct_code", "ma_account_num"], "inner")
df = df.withColumn("account_open_date", to_date(
    "account_open_date", "yyyy-MM-dd"))
# Move Column cif_num to first
colList = df_ca.columns
colList.insert(0, "cif_num")
df = df.select(colList)

# Drop/Masking sensitive personal information
df = df.withColumn("cif_num", reverse("cif_num"))
df = df.withColumn("account_num", reverse("account_num"))
df = df.withColumn("ma_account_num", reverse("ma_account_num"))

dyf = DynamicFrame.fromDF(df, glueContext, "nested")

sink_target = glueContext.getSink(
    path="s3://" + args["target_bucket_name"] + "/" + PREFIX,
    connection_type="s3",
    updateBehavior="UPDATE_IN_DATABASE",
    partitionKeys=[],
    compression="snappy",
    enableUpdateCatalog=True,
    transformation_ctx="S3bucket_write_raw",
)

sink_target.setCatalogInfo(
    catalogDatabase=args["target_glue_database"], catalogTableName="customeraccount"
)

sink_target.setFormat("glueparquet")

sink_target.writeFrame(dyf)
