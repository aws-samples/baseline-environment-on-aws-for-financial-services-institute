import './lib/otel';
import { trace } from '@opentelemetry/api';
import { QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DummySk, MainTableName, ddbClient } from './lib/dynamodb';
import { setTimeout } from 'timers/promises';
import axios from 'axios';
import { getStopFlag } from './lib/params';

/**
 * 仕掛かり中でペンディング状態となっているトランザクションを処理する常駐サービス
 */

const tracer = trace.getTracer('transaction');

const BalanceEndpoint = process.env.BALANCE_ENDPOINT || 'http://localhost:3001/balance';
const CountEndpoint = process.env.COUNT_ENDPOINT || 'http://localhost:3002/count';

let shouldTerminate = false;

process.on('SIGTERM', (err: any) => {
  shouldTerminate = true;
});

// Start the transaction worker
const run = async () => {
  while (!shouldTerminate) {
    if (await getStopFlag(true)) {
      console.log('workers in this region are disabled.');
      await setTimeout(10000);
      continue;
    }

    const transactions = await ddbClient.send(
      new QueryCommand({
        TableName: MainTableName,
        KeyConditionExpression: 'GSI1 = :gsi1',
        ExpressionAttributeValues: {
          ':gsi1': 'status#pending',
        },
        IndexName: 'GSI1',
      }),
    );
    console.log(`found ${transactions.Items?.length} pending transactions`);

    // Practically we need distributed processing of transactions, but omitting that for now.
    for (const transaction of transactions.Items ?? []) {
      try {
        await tracer.startActiveSpan('process transaction', async (span) => {
          await processTransaction(transaction.PK).finally(() => span.end());
        });
        // https://opentelemetry.io/docs/languages/js/instrumentation/#create-spans
      } catch (e) {
        console.log(e);
      }
    }

    await setTimeout(1000);
  }
};

// Process a transaction.
// To understand the sequence of steps, please refer to the UML diagrams in the imgs directory.
const processTransaction = async (transactionId: string) => {
  // We can also resume interrupted transactions.
  const res = await ddbClient.send(
    new QueryCommand({
      TableName: MainTableName,
      KeyConditionExpression: 'PK = :pk',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':pk': `${transactionId}#step`,
        ':status': 'pending',
      },
      ConsistentRead: true,
    }),
  );

  console.log(JSON.stringify(res.Items));

  if (res.Items == null || res.Items.length != 1) {
    // can enter here due to GSI replication lag.
    console.log(`Something is wrong. Retry the transaction later.`);
    return;
  }

  const currentStep = res.Items[0];

  await processTransactionStep(transactionId, {
    name: currentStep.SK,
    accountId: currentStep.accountId,
    payload: JSON.parse(currentStep.payload),
  });
};

const processTransactionStep = async (
  transactionId: string,
  currentStep: { name: string; accountId: string; payload: any },
) => {
  const { payload, accountId } = currentStep;
  switch (currentStep.name) {
    case 'withdraw_count': {
      try {
        const res = await axios.put(
          `${CountEndpoint}/withdraw`,
          { period: payload.period, transactionId },
          {
            headers: {
              X_ACCOUNT_ID: accountId,
            },
          },
        );
        return await continueTransaction(
          transactionId,
          accountId,
          { ...payload, count: res.data.count },
          'withdraw_count',
          'withdraw_balance',
          true,
        );
      } catch (e) {
        console.log(e);
        return await continueTransaction(
          transactionId,
          accountId,
          { ...payload },
          'withdraw_count',
          'withdraw_count_comp',
          false,
        );
      }
    }
    case 'withdraw_balance':
      try {
        await axios.put(
          `${BalanceEndpoint}/withdraw`,
          { quantity: payload.quantity, withdrawalCount: payload.count, transactionId },
          {
            headers: {
              X_ACCOUNT_ID: accountId,
            },
          },
        );
        return await completeTransaction(transactionId, accountId, 'withdraw_balance', false);
      } catch (e) {
        console.log(e);
        return await continueTransaction(
          transactionId,
          accountId,
          { ...payload },
          'withdraw_balance',
          'withdraw_balance_comp',
          false,
        );
      }
    case 'withdraw_balance_comp':
      try {
        await axios.put(
          `${BalanceEndpoint}/cancel_withdraw`,
          { quantity: payload.quantity, withdrawalCount: payload.count, transactionId },
          {
            headers: {
              X_ACCOUNT_ID: accountId,
            },
          },
        );
        return await continueTransaction(
          transactionId,
          accountId,
          { ...payload },
          'withdraw_balance_comp',
          'withdraw_count_comp',
          true,
        );
      } catch (e) {
        console.log(e);
        // do nothing, will be retried after this loop
        return;
      }
    case 'withdraw_count_comp':
      try {
        await axios.put(
          `${CountEndpoint}/cancel_withdraw`,
          { period: payload.period, transactionId },
          {
            headers: {
              X_ACCOUNT_ID: accountId,
            },
          },
        );
        return await completeTransaction(transactionId, accountId, 'withdraw_count_comp', true);
      } catch (e) {
        console.log(e);
        // do nothing, will be retried after this loop
        return;
      }
    case 'deposit_balance':
      try {
        await axios.put(
          `${BalanceEndpoint}/deposit`,
          { quantity: payload.quantity, transactionId },
          {
            headers: {
              X_ACCOUNT_ID: accountId,
            },
          },
        );
        return await completeTransaction(transactionId, accountId, 'deposit_balance', false);
      } catch (e) {
        console.log(e);
        return await continueTransaction(
          transactionId,
          accountId,
          { ...payload },
          'deposit_balance',
          'deposit_balance_comp',
          false,
        );
      }
    case 'deposit_balance_comp':
      try {
        await axios.put(
          `${BalanceEndpoint}/cancel_deposit`,
          { quantity: payload.quantity, transactionId },
          {
            headers: {
              X_ACCOUNT_ID: accountId,
            },
          },
        );
        return await completeTransaction(transactionId, accountId, 'deposit_balance_comp', true);
      } catch (e) {
        console.log(e);
        // do nothing, will be retried after this loop
        return;
      }
    default:
      console.log(`unknown step ${currentStep.name}`);
  }
};

const completeTransaction = async (
  transactionId: string,
  accountId: string,
  currentStep: string,
  rollback: boolean,
) => {
  const date = new Date().toISOString();
  await ddbClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: MainTableName,
            Key: {
              PK: `${transactionId}#step`,
              SK: currentStep,
            },
            UpdateExpression: 'set #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': 'success',
              ':updatedAt': date,
            },
          },
        },
        {
          Update: {
            TableName: MainTableName,
            Key: {
              PK: `${transactionId}`,
              SK: DummySk,
            },
            UpdateExpression: 'set GSI1 = :status, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':status': rollback ? 'status#success_rollback' : 'status#success',
              ':updatedAt': date,
            },
          },
        },
        {
          Delete: {
            TableName: MainTableName,
            Key: {
              PK: `${accountId}#lock`,
              SK: DummySk,
            },
          },
        },
      ],
    }),
  );
};

const continueTransaction = async (
  transactionId: string,
  accountId: string,
  payload: any,
  currentStep: string,
  nextStep: string,
  success: boolean,
) => {
  const date = new Date().toISOString();
  await ddbClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: MainTableName,
            Key: {
              PK: `${transactionId}#step`,
              SK: currentStep,
            },
            UpdateExpression: 'set #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': success ? 'success' : 'failed',
              ':updatedAt': date,
            },
          },
        },
        {
          Put: {
            TableName: MainTableName,
            Item: {
              PK: `${transactionId}#step`,
              SK: nextStep,
              status: 'pending',
              accountId,
              payload: JSON.stringify(payload),
              updatedAt: date,
              createdAt: date,
            },
          },
        },
      ],
    }),
  );

  await processTransactionStep(transactionId, {
    name: nextStep,
    accountId,
    payload,
  });
};

run();
