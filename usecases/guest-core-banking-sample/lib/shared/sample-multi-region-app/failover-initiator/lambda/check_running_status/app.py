import boto3
import os

def handler(event, context):
    sfn = boto3.client('stepfunctions')
    target_state_machines = [
        os.environ.get('failoverStateMachineArn'),
        os.environ.get('failbackStateMachineArn'),
    ]

    running_flags = []
    for sm_arn in target_state_machines:
        print(sm_arn);
        executions = sfn.list_executions(
            stateMachineArn=sm_arn,
            statusFilter='RUNNING'
        )
        running_flags.append(len(executions['executions']) > 0)

    return {
        "fo-Running": running_flags[0],
        "fb-Running": running_flags[1],
        "bothIdle": not any(running_flags)
    }
