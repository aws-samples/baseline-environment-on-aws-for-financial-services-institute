"""正規化レイヤーから分析用のインバン日数情報を作成するためのGlue PySpark ETLジョブ。
   正規化レイヤーのGlueテーブルを参照し、分析レイヤーのGlueテーブルを作成して、S3にデータを出力する。
   生成したS3データは最新版のみ保持し、古いデータを削除する。
"""

import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql.functions import datediff, to_date, lit
from awsglue.context import GlueContext
from awsglue.dynamicframe import DynamicFrame
from datetime import datetime
import boto3
import pytz

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

PREFIX = "InternetBankingPeriod"
# delete old target data
s3 = boto3.client("s3")
TARGET_BUCKET_NAME = args["target_bucket_name"]
response = s3.list_objects_v2(
    Bucket=TARGET_BUCKET_NAME, Prefix=PREFIX + "/")
if "Contents" in response:
    for object in response["Contents"]:
        source_key = object["Key"]
        s3.delete_object(Bucket=TARGET_BUCKET_NAME, Key=source_key)

dyf_source = glueContext.create_dynamic_frame.from_catalog(
    database=args["source_glue_database"],
    table_name="internetbankinguser",
    transformation_ctx="AWSGlueDataCatalog",
)

df = dyf_source.toDF()

current_date = (
    datetime.now(pytz.timezone("Asia/Tokyo"))).strftime("%Y%m%d")
df = df.withColumn("base_date", lit(current_date))
df = df.withColumn("base_date", to_date("base_date", "yyyyMMdd"))
df = df.withColumn("inban_period", datediff("base_date", "join_date"))
df = df.drop("email_address", "userid", "join_date")
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
    catalogDatabase=args["target_glue_database"], catalogTableName="internetbankingperiod"
)

sink_target.setFormat("glueparquet")

sink_target.writeFrame(dyf)
