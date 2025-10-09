import boto3
import os

ALARM_1 = {
    "region": os.environ.get('secondaryRegion'),
    "name": os.environ.get('secondaryAlarmName'),
}

ALARM_2 = {
    "region": os.environ.get('monitoringRegion'),
    "name": os.environ.get('monitoringAlarmName'),
}

def check_alarm_state(alarm):
    client = boto3.client("cloudwatch", region_name=alarm["region"])
    response = client.describe_alarms(
        AlarmNames=[alarm["name"]],
        StateValue='ALARM'  # Optional, to filter only ALARM state
    )
    alarms = response.get("MetricAlarms", [])
    return any(a["StateValue"] == "ALARM" for a in alarms)

def handler(event, context):
    alarm1_in_alarm = check_alarm_state(ALARM_1)
    alarm2_in_alarm = check_alarm_state(ALARM_2)

    print(f"alarm:{ALARM_1['name']} in {ALARM_1['region']} is in alarm => {alarm1_in_alarm}")
    print(f"alarm:{ALARM_2['name']} in {ALARM_2['region']} is in alarm => {alarm2_in_alarm}")

    both_in_alarm = alarm1_in_alarm and alarm2_in_alarm

    return {
        "bothInAlarm": both_in_alarm
    }

