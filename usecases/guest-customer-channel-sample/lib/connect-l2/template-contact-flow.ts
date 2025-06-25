import { ContactFlow, ContactFlowType } from './contact-flow';
import { Construct } from 'constructs';
import * as fs from 'fs';
import { IInstance } from './instance';

export interface TemplateContactFlowProps {
  readonly instance: IInstance;
  readonly name: string;
  readonly type: ContactFlowType;
  readonly description?: string;
  readonly path: string;
  readonly variables?: { [key: string]: string };
}

export class TemplateContactFlow extends ContactFlow {
  constructor(scope: Construct, id: string, props: TemplateContactFlowProps) {
    const templateContent = fs.readFileSync(props.path, 'utf-8');
    const content = Object.entries(props.variables || {}).reduce((acc, [key, value]) => {
      return acc.replace(new RegExp(`%${key}%`, 'g'), value);
    }, templateContent);

    super(scope, id, {
      instance: props.instance,
      name: props.name,
      type: props.type,
      description: props.description,
      content,
    });
  }
}
