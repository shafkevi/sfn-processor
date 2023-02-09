import { Construct } from 'constructs';

import { Duration } from "aws-cdk-lib";
import { aws_lambda as lambda } from "aws-cdk-lib";
import { aws_stepfunctions as stepfunctions } from "aws-cdk-lib";
import { aws_stepfunctions_tasks as stepfunctions_tasks } from "aws-cdk-lib";
import { TIMEOUT } from 'dns';

export interface LambdaTaskProps {
  codeLocation: string,
  handler: string,
  runtime: lambda.Runtime,
  resultPath?: string,
  payload?: stepfunctions.TaskInput
  timeout?: number,
  environment?: { [key: string]: string},
}

export default class LambdaTask extends Construct {
  public readonly function: lambda.Function;
  public readonly task: stepfunctions_tasks.LambdaInvoke;

  constructor(scope: Construct, id: string, props: LambdaTaskProps) {
    super(scope, id);

    const { 
      codeLocation,
      handler,
      runtime,
      resultPath,
      payload,
      timeout,
      environment,
    } = props;

    this.function = new lambda.Function(this, "Function", {
      runtime: runtime,
      handler: handler,
      code: new lambda.AssetCode(codeLocation),
      tracing: lambda.Tracing.ACTIVE,
      timeout: Duration.seconds(timeout || 30),
      environment: environment
    });

    this.task = new stepfunctions_tasks.LambdaInvoke(this, `LambdaTask${id}`, {
      lambdaFunction: this.function,
      payloadResponseOnly: true,
      resultPath: resultPath,
      payload: payload,
    });

  }
}
