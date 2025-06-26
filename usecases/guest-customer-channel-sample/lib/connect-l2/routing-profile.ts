import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as connect from 'aws-cdk-lib/aws-connect';
import { IInstance } from './instance';
import { IQueue } from './queue';

export enum ChannelType {
  VOICE = 'VOICE',
  CHAT = 'CHAT',
  TASK = 'TASK',
  EMAIL = 'EMAIL',
}

export interface MediaConcurrency {
  readonly channel: ChannelType;
  readonly concurrency: number;
}

export interface RoutingProfileQueueConfig {
  readonly queue: IQueue;
  readonly priority: number;
  readonly delay: number;
  readonly channel: ChannelType;
}

export interface RoutingProfileProps {
  readonly instance: IInstance;
  readonly routingProfileName: string;
  readonly description: string;
  readonly defaultOutboundQueue: IQueue;
  readonly mediaConcurrencies: MediaConcurrency[];
  readonly queueConfigs?: RoutingProfileQueueConfig[];
}

export interface IRoutingProfile extends IResource {
  readonly routingProfileArn: string;
  readonly routingProfileId: string;
}

export class RoutingProfile extends Resource implements IRoutingProfile {
  public readonly routingProfileArn: string;
  public readonly routingProfileId: string;

  constructor(scope: Construct, id: string, props: RoutingProfileProps) {
    super(scope, id);

    const routingProfile = new connect.CfnRoutingProfile(this, 'Resource', {
      instanceArn: props.instance.instanceArn,
      name: props.routingProfileName,
      description: props.description,
      defaultOutboundQueueArn: props.defaultOutboundQueue.queueArn,
      mediaConcurrencies: props.mediaConcurrencies.map((mediaConcurrency) => ({
        channel: mediaConcurrency.channel,
        concurrency: mediaConcurrency.concurrency,
      })),
      queueConfigs: props.queueConfigs?.map((queueConfig) => ({
        priority: queueConfig.priority,
        delay: queueConfig.delay,
        queueReference: {
          queueArn: queueConfig.queue.queueArn,
          channel: queueConfig.channel,
        },
      })),
    });

    this.routingProfileId = routingProfile.ref;
    this.routingProfileArn = routingProfile.attrRoutingProfileArn;

    this.node.addDependency(props.instance);
    this.node.addDependency(props.defaultOutboundQueue);
  }
}
