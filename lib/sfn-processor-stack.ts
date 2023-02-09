import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_secretsmanager as secretsmanager } from "aws-cdk-lib";

import { aws_events as events } from "aws-cdk-lib";
import { aws_lambda as lambda } from "aws-cdk-lib";
import { aws_stepfunctions as stepfunctions } from "aws-cdk-lib";
import { aws_events_targets as event_targets } from "aws-cdk-lib";
import LambdaTask from "./constructs/LambdaTask";
import { join } from 'path';

export class SfnProcessorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const secretArn = process.env.SECRET_ARN || "";
    const secret = secretsmanager.Secret.fromSecretCompleteArn(this, 'Secret', secretArn);

    // Lambdas
    const step1Lambda = new LambdaTask(this, "Step1", {
      codeLocation: join(__dirname, "../functions/step-1"),
      handler: "app.lambdaHandler",
      runtime: lambda.Runtime.NODEJS_16_X,
      timeout: 30,
      environment: {SECRET_ARN: secret.secretArn},
      payload: stepfunctions.TaskInput.fromObject({
        sfnId: stepfunctions.JsonPath.stringAt('$$.Execution.Id'),
        payload: stepfunctions.JsonPath.stringAt('$.detail'),
      }),
    });
    secret.grantRead(step1Lambda.function);

    const step3aLambda = new LambdaTask(this, "Step3a", {
      codeLocation: join(__dirname, "../functions/step-3a"),
      handler: "app.lambdaHandler",
      runtime: lambda.Runtime.NODEJS_16_X,
      timeout: 30,
      environment: {SECRET_ARN: secret.secretArn},
    });
    secret.grantRead(step3aLambda.function);

    const step3bLambda = new LambdaTask(this, "Step3b", {
      codeLocation: join(__dirname, "../functions/step-3b"),
      handler: "app.lambdaHandler",
      runtime: lambda.Runtime.NODEJS_16_X,
      timeout: 30,
      environment: {SECRET_ARN: secret.secretArn},
    });
    secret.grantRead(step3bLambda.function);

    const step4Lambda = new LambdaTask(this, "Step4", {
      codeLocation: join(__dirname, "../functions/step-4"),
      handler: "app.lambdaHandler",
      runtime: lambda.Runtime.NODEJS_16_X,
      timeout: 30,
      environment: {SECRET_ARN: secret.secretArn},
    });
    secret.grantRead(step4Lambda.function);

    // State machine

    // Define the steps
    const definition = step1Lambda.task
      .next(new stepfunctions.Choice(this, 'Step2')
        .when(
          stepfunctions.Condition.stringEquals("$.nextStep","a"),
          step3aLambda.task
        )
        .otherwise(step3bLambda.task)
        .afterwards()
      ).next(step4Lambda.task);

    const stateMachine = new stepfunctions.StateMachine(this, 'ProcessingStateMachine', {
      definition: definition,
    });

    // Create new event bus
    const bus = new events.EventBus(this, 'ProcessingEventBus', {
      eventBusName: 'CdkProcessingEventBus'
    });

    // Create rule to kickoff state machine when message matches source.
    const eventBridgeRule = new events.Rule(this, 'ProcessingEventRule', {
      eventBus: bus,
      targets: [new  event_targets.SfnStateMachine(stateMachine)],
      eventPattern: {
        source: ['api.processingEvent'],
      },
    });


  }
}
