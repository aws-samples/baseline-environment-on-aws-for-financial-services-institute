import express, { NextFunction, Request, Response } from 'express';
import { DummySk, MainTableName, ddbClient } from './lib/dynamodb';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getStopFlag } from './lib/params';

/**
 * トランザクション全体を制御するマイクロサービス
 */
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.send('ok');
});

const router = express.Router();
router.use(async (req, res, next) => {
  if (await getStopFlag(false)) {
    res.status(503).send('transaction service is temporarily stopped');
    return;
  }
  next();
});

//口座からの引落し処理
router.post('/withdraw', async (req, res, next) => {
  try {
    const accountId = req.headers['x_account_id'];
    if (typeof accountId !== 'string') {
      res.status(400).send();
      return;
    }

    const quantity: number = req.body.quantity;
    if (typeof quantity !== 'number' && quantity < 0) {
      res.status(400).send();
      return;
    }

    const transactionId = uuidv4();
    const date = new Date().toISOString();

    try {
      await ddbClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: MainTableName,
                Item: {
                  PK: `${accountId}#lock`,
                  SK: DummySk,
                  createdAt: date,
                },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            {
              Put: {
                TableName: MainTableName,
                Item: {
                  PK: `${transactionId}#step`,
                  SK: 'withdraw_count',
                  status: 'pending',
                  accountId,
                  payload: JSON.stringify({ accountId, quantity, period: 'TODO' }),
                  updatedAt: date,
                  createdAt: date,
                },
              },
            },
            {
              Put: {
                TableName: MainTableName,
                Item: {
                  PK: transactionId,
                  SK: DummySk,
                  GSI1: `status#pending`,
                  accountId,
                  updatedAt: date,
                  createdAt: date,
                },
              },
            },
          ],
        }),
      );
    } catch (e: any) {
      if (e.name === 'TransactionCanceledException') {
        res.status(429).send('There is a pending transaction. Try again later.');
        return;
      }
      throw e;
    }

    res.send({ transactionId });
  } catch (e) {
    next(e);
  }
});

//口座への預入れ処理
router.post('/deposit', async (req, res, next) => {
  try {
    const accountId = req.headers['x_account_id'];
    if (typeof accountId !== 'string') {
      res.status(400).send();
      return;
    }

    const quantity: number = req.body.quantity;
    if (typeof quantity !== 'number' && quantity < 0) {
      res.status(400).send();
      return;
    }

    const transactionId = uuidv4();
    const date = new Date().toISOString();

    try {
      await ddbClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: MainTableName,
                Item: {
                  PK: `${accountId}#lock`,
                  SK: DummySk,
                  createdAt: date,
                },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            {
              Put: {
                TableName: MainTableName,
                Item: {
                  PK: `${transactionId}#step`,
                  SK: 'deposit_balance',
                  status: 'pending',
                  accountId,
                  payload: JSON.stringify({ accountId, quantity }),
                  updatedAt: date,
                  createdAt: date,
                },
              },
            },
            {
              Put: {
                TableName: MainTableName,
                Item: {
                  PK: transactionId,
                  SK: DummySk,
                  GSI1: `status#pending`,
                  accountId,
                  updatedAt: date,
                  createdAt: date,
                },
              },
            },
          ],
        }),
      );
    } catch (e: any) {
      if (e.name === 'TransactionCanceledException') {
        res.status(429).send('There is a pending transaction. Try again later.');
        return;
      }
      throw e;
    }

    res.send({ transactionId });
  } catch (e) {
    next(e);
  }
});

//トランザクションログ情報の取得
router.get('/:transactionId', async (req, res, next) => {
  try {
    const transactionId = req.params.transactionId;
    const accountId = req.headers['x_account_id'];
    if (typeof accountId !== 'string') {
      res.status(400).send();
      return;
    }

    const transaction = await ddbClient.send(
      new GetCommand({
        TableName: MainTableName,
        Key: {
          PK: transactionId,
          SK: DummySk,
        },
      }),
    );

    if (transaction.Item?.accountId !== accountId) {
      res.status(404).send();
      return;
    }

    res.send({ status: transaction.Item.GSI1, updatedAt: transaction.Item.updatedAt });
  } catch (e) {
    next(e);
  }
});

app.use('/transaction', router);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.log(err.stack);
  res.status(500).send(err.message);
});

// https://github.com/wclr/ts-node-dev/issues/120
['SIGTERM', 'SIGHUP', 'SIGINT'].forEach((sig) =>
  process.on(sig, (err: any) => {
    process.exit(1);
  }),
);

app.listen(3000, () => {
  console.log('Server started on port 3000');
});
