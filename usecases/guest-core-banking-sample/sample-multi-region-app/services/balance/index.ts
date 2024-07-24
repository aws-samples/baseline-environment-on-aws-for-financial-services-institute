import './lib/otel';
import express, { NextFunction, Request, Response } from 'express';

/**
 * PostgresDBで管理される口座データに対して引落し/預入れ処理を行うマイクロサービス
 */
const app = express();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

app.use(express.json());

app.get('/health', (req, res) => {
  res.send('ok');
});

//残高照会
app.get('/balance', async (req, res, next) => {
  const accountId = req.headers['x_account_id'];
  if (typeof accountId !== 'string') {
    res.status(400).send();
    return;
  }

  try {
    const balance = await prisma.balance.findUnique({
      where: {
        accountId,
      },
    });

    res.send({
      balance: balance?.quantity ?? 0,
      accountId,
    });
  } catch (e) {
    next(e);
  }
});

//口座からの引落し処理
app.put('/balance/withdraw', async (req, res, next) => {
  try {
    const accountId = req.headers['x_account_id'];
    if (typeof accountId !== 'string') {
      res.status(400).send();
      return;
    }

    let quantity: number = req.body.quantity;
    const count: number = req.body.withdrawalCount;
    const transactionId: string = req.body.transactionId;

    if (quantity <= 0) {
      res.status(400).send('invalid quantity');
      return;
    }

    if (transactionId == null) {
      res.status(400).send('invalid transactionId');
      return;
    }

    if (count > 3) {
      // transaction fee
      quantity += 100;
    }

    const balance = await prisma.balance.findUnique({
      where: {
        accountId,
      },
    });

    if (balance == null) {
      res.status(400).send('the account is not registered');
      return;
    }

    if (balance.quantity < quantity) {
      res.status(400).send('insufficient balance');
      return;
    }

    if (balance.lastProcessedTransactionId == transactionId) {
      // the transaction is already processed
      res.status(200).send();
      return;
    }

    await prisma.balance.update({
      where: {
        accountId,
        lastProcessedTransactionId: { not: transactionId },
      },
      data: {
        quantity: balance.quantity - quantity,
        lastProcessedTransactionId: transactionId,
      },
    });

    res.send();
  } catch (e) {
    next(e);
  }
});

///balance/withdraw 処理をキャンセルする補償トランザクション
app.put('/balance/cancel_withdraw', async (req, res, next) => {
  try {
    const accountId = req.headers['x_account_id'];
    if (typeof accountId !== 'string') {
      res.status(400).send();
      return;
    }

    const quantity: number = req.body.quantity;
    const transactionId: string = req.body.transactionId;

    if (quantity <= 0) {
      res.status(400).send();
      return;
    }

    if (transactionId == null) {
      res.status(400).send();
      return;
    }

    const balance = await prisma.balance.findUnique({
      where: {
        accountId,
      },
    });

    if (balance == null) {
      // no need to cancel
      res.status(200).send();
      return;
    }

    if (balance.lastProcessedTransactionId != transactionId) {
      // the transaction has not been processed, no need to cancel
      res.status(200).send();
      return;
    }

    await prisma.balance.update({
      where: {
        accountId,
        lastProcessedTransactionId: transactionId,
      },
      data: {
        quantity: balance.quantity + quantity,
        lastProcessedTransactionId: transactionId + 'cancel',
      },
    });

    res.send();
  } catch (e) {
    next(e);
  }
});

//口座への預入れ処理
app.put('/balance/deposit', async (req, res, next) => {
  try {
    const accountId = req.headers['x_account_id'];
    if (typeof accountId !== 'string') {
      res.status(400).send();
      return;
    }

    const quantity: number = req.body.quantity;
    const transactionId: string = req.body.transactionId;

    if (quantity <= 0) {
      res.status(400).send('invalid quantity');
      return;
    }

    if (transactionId == null) {
      res.status(400).send('invalid transactionId');
      return;
    }

    const balance = await prisma.balance.findUnique({
      where: {
        accountId,
      },
    });

    if (balance == null) {
      await prisma.balance.create({
        data: {
          accountId,
          quantity: quantity,
          lastProcessedTransactionId: transactionId,
        },
      });

      res.send();
      return;
    }

    if (balance.lastProcessedTransactionId == transactionId) {
      // the transaction is already processed
      res.status(200).send();
      return;
    }

    await prisma.balance.update({
      where: {
        accountId,
        lastProcessedTransactionId: { not: transactionId },
      },
      data: {
        quantity: balance.quantity + quantity,
        lastProcessedTransactionId: transactionId,
      },
    });

    res.send();
  } catch (e) {
    next(e);
  }
});

// /balance/deposit 処理をキャンセルする補償トランザクション
app.put('/balance/cancel_deposit', async (req, res, next) => {
  try {
    const accountId = req.headers['x_account_id'];
    if (typeof accountId !== 'string') {
      res.status(400).send();
      return;
    }

    const quantity: number = req.body.quantity;
    const transactionId: string = req.body.transactionId;

    if (quantity <= 0) {
      res.status(400).send('invalid quantity');
      return;
    }

    if (transactionId == null) {
      res.status(400).send('invalid transactionId');
      return;
    }

    const balance = await prisma.balance.findUnique({
      where: {
        accountId,
      },
    });

    if (balance == null) {
      // the transaction has not been processed, no need to cancel
      res.status(200).send();
      return;
    }

    if (balance.lastProcessedTransactionId != transactionId) {
      // the transaction has not been processed, no need to cancel
      res.status(200).send();
      return;
    }

    await prisma.balance.update({
      where: {
        accountId,
        lastProcessedTransactionId: transactionId,
      },
      data: {
        quantity: balance.quantity - quantity,
        lastProcessedTransactionId: transactionId + 'cancel',
      },
    });

    res.send();
  } catch (e) {
    next(e);
  }
});

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
