import string
import random
import os
import time
from locust import HttpUser, task
from locust.env import Environment

TIMEOUT_SECONDS = 3


class User(HttpUser):
    @task
    def get_index(self):
        # get a random string
        account_id = "".join(random.choices(string.ascii_lowercase, k=20))
        self.client.headers = {"X_ACCOUNT_ID": account_id}

        # deposit some money
        with self.client.post(
            "/transaction/deposit",
            json={"quantity": 1000},
            catch_response=True,
            timeout=TIMEOUT_SECONDS,
        ) as res:
            # need to validate the result manually: https://github.com/locustio/locust/issues/1953#issuecomment-988535231
            if res.status_code != 200:
                res.failure(f"Error: {res.status_code} - {res.text}")
                return
            else:
                res.success()
            txId = res.json()["transactionId"]

        if not self.wait_for_tx_success(txId):
            return

        for _ in range(3):
            # withdraw some money
            with self.client.post(
                "/transaction/withdraw",
                json={"quantity": 50},
                catch_response=True,
                timeout=TIMEOUT_SECONDS,
            ) as res:
                if res.status_code != 200:
                    res.failure(f"Error: {res.status_code} - {res.text}")
                    return
                else:
                    res.success()
                txId = res.json()["transactionId"]

            if not self.wait_for_tx_success(txId):
                return

    def wait_for_tx_success(self, txId):
        time.sleep(0.5)
        with self.client.get(
            f"/transaction/{txId}",
            name="/transaction/<txId>",
            catch_response=True,
            timeout=TIMEOUT_SECONDS,
        ) as res:
            if res.status_code != 200:
                res.failure(f"Error: {res.status_code} - {res.text}")
                return False
            status = res.json()["status"]
            if "pending" in status:
                res.success()
            elif "rollback" in status:
                res.failure("transaction was rolled back")
                return False
            elif "success" in status:
                res.success()
                return True
            else:
                res.failure(f"transaction was not success {status}")
                return False
        return self.wait_for_tx_success(txId)


if __name__ == "__main__":
    print("Running E2E test")
    host = os.environ.get("E2E_HOST", "http://localhost:3003")
    env = Environment(user_classes=[User], host=host)
    runner = env.create_local_runner()
    runner.start(3, spawn_rate=10)
    # running locust for 5 seconds is usually enough.
    time.sleep(5)
    runner.stop()

    endpoints = [
        ("/transaction/<txId>", "GET"),
        ("/transaction/deposit", "POST"),
        ("/transaction/withdraw", "POST"),
    ]
    for endpoint, method in endpoints:
        stat = env.stats.get(endpoint, method)
        if stat.num_requests == 0:
            raise Exception(f"No requests were sent for endpoint {endpoint}.")
        if stat.num_failures > 0:
            raise Exception(f"One or more requests failed for endpoint {endpoint}.")
        print(
            f"Endpoint {endpoint} was called {stat.num_requests} times, with {stat.num_failures} failures."
        )

    print("E2E test passed")
