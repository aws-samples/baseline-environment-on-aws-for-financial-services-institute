# [Customer Channel] Deployment of the application sample

## Deployment

1. Clone this repository.
2. Edit the context file `cdk.json`.
   - You need to set the globally unique values to `instanceAlias`.
3. Log in to the guest account.

```sh
aws sso login --profile ct-guest-sso
```

4. Run the following commands:
   - You can switch the deployed environment using the context value. (e.g., `-c environment=prod`)

```sh
cd usecases/guest-customer-channel-sample
npx cdk deploy -c environment=dev --all --profile ct-guest
```

## Caveats

- If you once deployed the CDK stacks and fail to deploy them again,
  please try to clean up all of the old resources via the CloudFormation console.
