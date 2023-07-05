"""生の取引明細データを正規化するためのGlue PySpark ETLジョブ。
   生データレイヤーのGlueテーブルを参照し、標準化レイヤーのGlueテーブルを作成して、S3にデータを出力する。
   ソースデータは未処理のデータを想定し、日付などのフィルタリングは実装しない。
"""

import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql.functions import *
from pyspark.sql.types import DateType, DecimalType
from awsglue.context import GlueContext
from awsglue.dynamicframe import DynamicFrame
from datetime import datetime, timedelta
from pyspark.sql.functions import *
import pytz
import os

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

# デフォルトの場合は取引日（パーティションキー）が前日のデータを取り込む
import_date = (
    datetime.now(pytz.timezone("Asia/Tokyo")) - timedelta(days=1)
).strftime("%Y%m%d")
YYYY = import_date[0:4]
MM = import_date[4:6]
DD = import_date[6:8]
pushDownPredicate = "(year == " + YYYY + " and month == " + \
    MM + " and day == " + DD + ")"

# import_dateが'all'に設定された場合のみ、pushDownPredicateを設定せず、データ全量取り込みを行う
# import_dateが'all'でない場合は取り込む日付（YYYYMMDD）と想定
if ("--{}".format("import_date") in sys.argv):
    optionalArgs = getResolvedOptions(sys.argv, ["import_date"])
    if "all" == optionalArgs["import_date"]:
        pushDownPredicate = ""
    elif optionalArgs["import_date"].isdecimal() and len(optionalArgs["import_date"]) == 8:
        import_date = optionalArgs["import_date"]
        YYYY = import_date[0:4]
        MM = import_date[4:6]
        DD = import_date[6:8]
        pushDownPredicate = "(year == " + YYYY + \
            " and month == " + MM + " and day == " + DD + ")"

# get source data
dyf_source = glueContext.create_dynamic_frame.from_catalog(
    database=args["source_glue_database"],
    table_name="depositwithdrawhistory",
    transformation_ctx="AWSGlueDataCatalog",
    push_down_predicate=pushDownPredicate,
)

# 処理データがない場合はジョブをEXITする
if dyf_source.count() == 0:
    os._exit(0)

df_source = dyf_source.toDF()

df_source = df_source.withColumn("trx_number", expr("uuid()"))


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
    "calc_date", YYMMDDtoDatetimeUDF(col("calc_date")))

df_source = df_source.withColumn(
    "trx_date",
    to_date(
        concat(
            df_source.year,
            lit("-"),
            lpad("month", 2, "0"),
            lit("-"),
            lpad("day", 2, "0"),
        ),
        "yyyy-MM-dd",
    ),
)
df_source = df_source.withColumn(
    "trx_timestamp",
    to_timestamp(
        concat(
            df_source.year,
            lpad("month", 2, "0"),
            lpad("day", 2, "0"),
            df_source.trx_time,
        ),
        "yyyyMMddHH:mm:ss.SSS",
    ),
)

df_source = df_source.select(
    df_source.year,
    df_source.month,
    df_source.day,
    df_source.trx_number,
    df_source.br_num,
    df_source.acct_code,
    df_source.account_num,
    df_source.trx_date,
    df_source.trx_timestamp,
    df_source.calc_date,
    df_source.deposit.cast(DecimalType(precision=10, scale=0)),
    df_source.withdrawal.cast(DecimalType(precision=10, scale=0)),
    df_source.check_type,
    df_source.check_num,
    df_source.balance.cast(DecimalType(precision=10, scale=0)),
    df_source.trx_type,
    df_source.dst_fin_institute_num,
    df_source.dst_fin_br_num,
    df_source.dst_fin_acct_code,
    df_source.dst_fin_acct_num,
    df_source.notes,
)

# Drop/Masking sensitive personal information
df_source = df_source.withColumn("account_num", reverse("account_num"))

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
