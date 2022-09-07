FROM jboss/keycloak:16.1.1
ENV X509_CA_BUNDLE /etc/x509/https/x509_ca_bundle/ca.crt /etc/x509/https/x509_ca_bundle/inca.crt
COPY ./authserver.crt /etc/x509/https/tls.crt
COPY ./authserver.key /etc/x509/https/tls.key
COPY ./ca.crt /etc/x509/https/x509_ca_bundle/ca.crt
COPY ./inca.crt /etc/x509/https/x509_ca_bundle/inca.crt
