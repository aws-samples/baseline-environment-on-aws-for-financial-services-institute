"""オリジナル顧客データをデータレイク生データのレイヤーにコピーするためのGlue PySpark ETLジョブ。
   オリジンレイヤーのGlueテーブルを参照し、生データレイヤーのGlueテーブルを作成して、S3にデータを出力する。
   生成した古いS3データをアーカイブする。
"""

import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
import boto3
from datetime import datetime, timedelta
import pytz

args = getResolvedOptions(
    sys.argv,
    [
        # 以下ジョブ作成時付与されるデフォルトパラメーター
        "target_bucket_name",
        "source_glue_database",
        "target_glue_database",
        "source_bucket_name",
    ],
)

sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session

PREFIX = "Customer"
# move old target data to archive
s3 = boto3.client("s3")
PREVIOUS_DATE_YYYYMMDD = (
    datetime.now(pytz.timezone("Asia/Tokyo")) - timedelta(days=1)
).strftime("%Y%m%d")
TARGET_BUCKET_NAME = args["target_bucket_name"]
response = s3.list_objects_v2(
    Bucket=TARGET_BUCKET_NAME, Prefix=PREFIX + "/")
if "Contents" in response:
    for object in response["Contents"]:
        # 移動元
        source_key = object["Key"]
        # 移動先
        destination_key = source_key.replace(
            PREFIX, PREFIX + "-" + PREVIOUS_DATE_YYYYMMDD
        )

        # ファイルを移動
        s3.copy_object(
            Bucket=TARGET_BUCKET_NAME,
            CopySource={"Bucket": TARGET_BUCKET_NAME, "Key": source_key},
            Key=destination_key,
        )

        # 移動元のファイルを削除
        s3.delete_object(Bucket=TARGET_BUCKET_NAME, Key=source_key)

dyf_source = glueContext.create_dynamic_frame.from_catalog(
    database=args["source_glue_database"],
    table_name="customer",
    transformation_ctx="AWSGlueDataCatalog",
    additional_options={"useCatalogSchema": True},
)

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
    catalogDatabase=args["target_glue_database"], catalogTableName="customer"
)

sink_target.setFormat("glueparquet")

sink_target.writeFrame(dyf_source)

# delete processed origin data
SOURCE_BUCKET_NAME = args["source_bucket_name"]
response = s3.list_objects_v2(
    Bucket=SOURCE_BUCKET_NAME, Prefix=PREFIX + "/")
for object in response["Contents"]:
    source_key = object["Key"]
    if source_key != PREFIX + "/":
        s3.delete_object(Bucket=SOURCE_BUCKET_NAME, Key=source_key)
