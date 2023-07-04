FROM locustio/locust:2.15.1
COPY . ./

ENV E2E_HOST "http://host.docker.internal:3003"
EXPOSE 8089
# for standalone
ENTRYPOINT ["locust", "-f", "./locustfile.py"]
# for worker
# CMD [ "--worker", "--master-host", "MASTER_HOST_NAME"]
# for master
# CMD ["--master"]
