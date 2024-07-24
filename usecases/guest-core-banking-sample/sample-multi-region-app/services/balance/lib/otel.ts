import { Attributes, diag, DiagConsoleLogger, DiagLogLevel, SpanKind } from '@opentelemetry/api';
import { AlwaysOnSampler, BatchSpanProcessor, Sampler, SamplingDecision } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { SEMATTRS_HTTP_ROUTE, SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Resource } from '@opentelemetry/resources';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

// https://aws-otel.github.io/docs/getting-started/js-sdk/trace-manual-instr
const resource = Resource.default().merge(
  new Resource({
    [SEMRESATTRS_SERVICE_NAME]: process.env.SERVICE_NAME ?? 'balance-service',
  }),
);
const traceExporter = new OTLPTraceExporter();
const spanProcessor = new BatchSpanProcessor(traceExporter);

const sdk = new NodeSDK({
  textMapPropagator: new AWSXRayPropagator(),
  instrumentations: [
    new HttpInstrumentation(),
    new AwsInstrumentation({
      suppressInternalInstrumentation: true,
    }),
    new PrismaInstrumentation(),
    new ExpressInstrumentation(),
  ],
  resource,
  spanProcessors: [spanProcessor],
  traceExporter,
  idGenerator: new AWSXRayIdGenerator(),
  sampler: filterSampler(ignoreHealthCheck, new AlwaysOnSampler()),
});

type FilterFunction = (spanName: string, spanKind: SpanKind, attributes: Attributes) => boolean;

function filterSampler(filterFn: FilterFunction, parent: Sampler): Sampler {
  return {
    shouldSample(ctx, tid, spanName, spanKind, attr, links) {
      if (!filterFn(spanName, spanKind, attr)) {
        return { decision: SamplingDecision.NOT_RECORD };
      }
      return parent.shouldSample(ctx, tid, spanName, spanKind, attr, links);
    },
    toString() {
      return `FilterSampler(${parent.toString()})`;
    },
  };
}

function ignoreHealthCheck(spanName: string, spanKind: SpanKind, attributes: Attributes) {
  return spanKind !== SpanKind.SERVER || attributes[SEMATTRS_HTTP_ROUTE] !== '/health';
}

// this enables the API to record telemetry
sdk.start();
// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('Tracing and Metrics terminated'))
    .catch((error) => console.log('Error terminating tracing and metrics', error))
    .finally(() => process.exit(0));
});
