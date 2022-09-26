#!/bin/bash

#Cognito UserID and Password
export USER='xxxxx@xxxx.xxx'
export PASSWORD='xxxxxxxx'

#Cognito User pool ID and Client ID from AWS Management Console
export POOLID='ap-northeast-1_xxxxxxxx'
export CLIENTID='xxxxxxxxxxxxxxxxxxxx'

#API URL (CloudFront DomainName + /test)
export URL='https://xxxxxx.xxxxx.xxx/test'

#Set User Password by admin
aws cognito-idp admin-set-user-password --user-pool-id $POOLID --username $USER --password $PASSWORD --permanent

#Get ID Token from Cognito
export TOKEN=`aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id $CLIENTID --auth-parameter USERNAME=$USER,PASSWORD=$PASSWORD |grep IdToken |awk '{print $2}'`

#Print ID Token
echo "ID Token =" $TOKEN

