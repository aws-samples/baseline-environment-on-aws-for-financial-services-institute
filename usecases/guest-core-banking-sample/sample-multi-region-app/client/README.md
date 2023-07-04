## 利用方法

負荷テストツールである[Locust](https://locust.io/)の起動コマンドです。

```sh
docker build -t client .
docker run -p 8089:8089 client
```

Locust GUI を開くには `http://localhost:8089` にアクセスして下さい。

> サンプルアプリケーションをローカル環境で実行した場合は、ターゲットホストは `http://host.docker.internal:3003` になります。

## E2E テストの実行

E2E テストの実施には、次のコマンドを実行します。

```sh
cd ../services
docker compose up
cd -
docker build -t client .
docker run --entrypoint python3 client locustfile.py
```
