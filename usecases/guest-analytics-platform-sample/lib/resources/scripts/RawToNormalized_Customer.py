"""生の顧客データを標準化するためのGlue PySpark ETLジョブ。
   生データレイヤーのGlueテーブルを参照し、標準化レイヤーのGlueテーブルを作成して、S3にデータを出力する。
   生成したS3データは最新版のみ保持し、古いデータを削除する。
"""

import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql.functions import reverse, to_date, concat, substring, regexp_extract, lit
from pyspark.sql.types import StringType, IntegerType
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
address_regexp = "(...??[都道府県](.+?[市郡区])?(.+?[区町村])?)"

PREFIX = "Customer"
# delete old target data
s3 = boto3.client("s3")
TARGET_BUCKET_NAME = args["target_bucket_name"]
response = s3.list_objects_v2(
    Bucket=TARGET_BUCKET_NAME, Prefix=PREFIX + "/")
if "Contents" in response:
    for object in response["Contents"]:
        source_key = object["Key"]
        s3.delete_object(Bucket=TARGET_BUCKET_NAME, Key=source_key)

# get source data
dyf_source = glueContext.create_dynamic_frame.from_catalog(
    database=args["source_glue_database"],
    table_name="customer",
    transformation_ctx="AWSGlueDataCatalog",
)

# Custom Transform
df = dyf_source.toDF()
# Drop/Masking sensitive personal information
df = df.drop("last_name", "first_name", "middle_name", "phone_number",
             "blacklisted", "blacklist_info", "blacklist_date", "blacklist_time")
df = df.withColumn("cif_num", reverse("cif_num"))
df = df.withColumn("birthday", substring("birthday", 1, 8))
df = df.withColumn("birthday", concat("birthday", lit("01")))
df = df.withColumn("address", regexp_extract("address", address_regexp, 1))

# turn the column to Int temporially to fill the field with 0 using fillna function
df = df.withColumn("sex", df.sex.cast(IntegerType()))
df = df.withColumn("marriage", df.marriage.cast(IntegerType()))
df = df.fillna(0)
df = df.withColumn("sex", df.sex.cast(StringType()))
df = df.withColumn("marriage", df.marriage.cast(StringType()))

df = df.withColumn("birthday", to_date("birthday", "yyyy-MM-dd"))
dyf = DynamicFrame.fromDF(df, glueContext, "nested")

# write to s3
sink_target = glueContext.getSink(
    path="s3://" + args["target_bucket_name"] + "/" + PREFIX,
    connection_type="s3",
    updateBehavior="UPDATE_IN_DATABASE",
    partitionKeys=[],
    compression="snappy",
    enableUpdateCatalog=True,
    transformation_ctx="S3bucket_write_normalized",
)

# write to Glue DataCatalog
sink_target.setCatalogInfo(
    catalogDatabase=args["target_glue_database"], catalogTableName="customer"
)

sink_target.setFormat("glueparquet")

sink_target.writeFrame(dyf)
