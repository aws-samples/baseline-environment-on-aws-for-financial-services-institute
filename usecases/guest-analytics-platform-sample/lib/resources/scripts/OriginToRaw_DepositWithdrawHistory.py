"""オリジナル取引明細データをデータレイク生データのレイヤーにコピーするためのGlue PySpark ETLジョブ。
   オリジンレイヤーのGlueテーブルを参照し、生データレイヤーのGlueテーブルを作成して、S3にデータを出力する。
   ソースデータは未処理のデータを想定し、日付などのフィルタリングは実装しない。処理済みのS3データを削除する。
"""

import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from pyspark.sql.functions import *
from awsglue.dynamicframe import DynamicFrame
from pyspark.sql.types import DateType
from datetime import datetime
import boto3

args = getResolvedOptions(
    sys.argv,
    [
        # 以下ジョブ作成時付与されるデフォルトパラメーター
        "source_bucket_name",
        "target_bucket_name",
        "source_glue_database",
        "target_glue_database",
    ],
)

sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session

dyf_source = glueContext.create_dynamic_frame.from_catalog(
    database=args["source_glue_database"],
    table_name="depositwithdrawhistory",
    transformation_ctx="AWSGlueDataCatalog",
    additional_options={"useCatalogSchema": True},
)

df_source = dyf_source.toDF()


def YYMMDDtoDatetime(yymmdd):
    datenum = 0
    if 700000 < int(yymmdd):
        datenum = "19" + yymmdd
    else:
        datenum = "20" + yymmdd
    year = int(datenum[:4])
    month = int(datenum[4:6])
    day = int(datenum[6:8])
    return datetime(year, month, day)


YYMMDDtoDatetimeUDF = udf(lambda x: YYMMDDtoDatetime(x), DateType())

df_source = df_source.withColumn(
    "trx_date_tmp", YYMMDDtoDatetimeUDF(col("trx_date")))
df_source = df_source.withColumn("year", year(col("trx_date_tmp")))
df_source = df_source.withColumn("month", month(col("trx_date_tmp")))
df_source = df_source.withColumn("day", dayofmonth(col("trx_date_tmp")))
df_source = df_source.drop("trx_date_tmp")

dyf = DynamicFrame.fromDF(df_source, glueContext, "writes3")
sink_target = glueContext.getSink(
    path="s3://" + args["target_bucket_name"] + "/DepositWithdrawHistory",
    connection_type="s3",
    updateBehavior="UPDATE_IN_DATABASE",
    partitionKeys=["year", "month", "day"],
    compression="snappy",
    enableUpdateCatalog=True,
    transformation_ctx="S3bucket_write_raw",
)

sink_target.setCatalogInfo(
    catalogDatabase=args["target_glue_database"], catalogTableName="depositwithdrawhistory"
)

sink_target.setFormat("glueparquet")

sink_target.writeFrame(dyf)

# delete processed origin data
PREFIX = "DepositWithdrawHistory"
s3 = boto3.client("s3")
SOURCE_BUCKET_NAME = args["source_bucket_name"]
response = s3.list_objects_v2(
    Bucket=SOURCE_BUCKET_NAME, Prefix=PREFIX + "/")
for object in response["Contents"]:
    source_key = object["Key"]
    if source_key != PREFIX + "/":
        s3.delete_object(Bucket=SOURCE_BUCKET_NAME, Key=source_key)
