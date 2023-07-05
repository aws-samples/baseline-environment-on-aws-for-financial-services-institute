"""生のインバン契約データを標準化するためのGlue PySpark ETLジョブ。
   生データレイヤーのGlueテーブルを参照し、標準化レイヤーのGlueテーブルを作成して、S3にデータを出力する。
   生成したS3データは最新版のみ保持し、古いデータを削除する。
"""

import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql.functions import to_date, reverse
from awsglue.context import GlueContext
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

PREFIX = "InternetBankingUser"
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

df = df.withColumn("join_date", to_date("join_date", "yyyy-MM-dd"))

# Drop/Masking sensitive personal information
df = df.drop("password", "recent_password")
df = df.withColumn("cif_num", reverse("cif_num"))

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
    catalogDatabase=args["target_glue_database"], catalogTableName="internetbankinguser"
)

sink_target.setFormat("glueparquet")

sink_target.writeFrame(dyf)
