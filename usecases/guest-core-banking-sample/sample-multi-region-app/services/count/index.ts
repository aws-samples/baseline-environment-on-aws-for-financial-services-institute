import express, { NextFunction, Request, Response } from 'express';

/**
 * 口座からの引落し処理の回数を管理するマイクロサービス
 */
const app = express();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

app.use(express.json());

app.get('/health', (req, res) => {
  res.send('ok');
});

//口座からの引落し回数を増やす
app.put('/count/withdraw', async (req, res, next) => {
  try {
    const accountId = req.headers['x_account_id'];
    if (typeof accountId !== 'string') {
      res.status(400).send();
      return;
    }

    const period: string = req.body.period;
    const transactionId: string = req.body.transactionId;

    if (transactionId == null) {
      res.status(400).send('invalid transactionId');
      return;
    }
    if (period == null) {
      res.status(400).send('invalid period');
      return;
    }

    let count = await prisma.count.findUnique({
      where: {
        accountId_period: {
          accountId,
          period,
        },
      },
    });

    if (count == null) {
      count = await prisma.count.create({
        data: {
          accountId,
          period,
          count: 1,
          lastProcessedTransactionId: transactionId,
        },
      });
    } else {
      if (count.lastProcessedTransactionId != transactionId) {
        count = await prisma.count.update({
          where: {
            // We can use optimistic locking here, but omitting it for simplicity
            // Since TX manager guarantees only one transaction is processed at at a time,
            // it is not really necessary to use a lock mechanism here.
            accountId_period: {
              accountId,
              period,
            },
          },
          data: {
            count: count.count + 1,
            lastProcessedTransactionId: transactionId,
          },
        });
      }
    }

    res.send({ count: count.count });
  } catch (e) {
    next(e);
  }
});

// /count/withdraw 処理をキャンセルする保証トランザクション
app.put('/count/cancel_withdraw', async (req, res, next) => {
  try {
    const accountId = req.headers['x_account_id'];
    if (typeof accountId !== 'string') {
      res.status(400).send();
      return;
    }

    const period: string = req.body.period;
    const transactionId: string = req.body.transactionId;

    if (transactionId == null) {
      res.status(400).send();
      return;
    }
    if (period == null) {
      res.status(400).send('invalid period');
      return;
    }

    let count = await prisma.count.findUnique({
      where: {
        accountId_period: {
          accountId,
          period,
        },
      },
    });

    if (count?.lastProcessedTransactionId == transactionId) {
      count = await prisma.count.update({
        where: {
          accountId_period: {
            accountId,
            period,
          },
        },
        data: {
          count: count.count - 1,
          lastProcessedTransactionId: transactionId + 'canceled',
        },
      });
    }

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
process.on('SIGTERM', (err: any) => {
  process.exit(1);
});

app.listen(3000, () => {
  console.log('Server started on port 3000');
});
