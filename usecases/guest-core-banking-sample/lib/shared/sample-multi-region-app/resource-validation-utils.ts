import { TaskDefinition } from 'aws-cdk-lib/aws-ecs';

/**
 * リソース配分の検証とバリデーション用ユーティリティ関数
 *
 * CloudWatch Application Signals 移行に伴うリソース設定の妥当性を検証します。
 */

/**
 * Fargate タスク定義のリソース設定
 */
export interface FargateResourceConfig {
  cpu: number; // vCPU ユニット (256, 512, 1024, etc.)
  memoryMiB: number; // メモリ (MiB)
}

/**
 * コンテナのリソース配分設定
 */
export interface ContainerResourceAllocation {
  name: string;
  cpu: number; // CPU ユニット
  memoryReservationMiB: number; // メモリ予約 (MiB)
  memoryLimitMiB: number; // メモリ上限 (MiB)
  essential: boolean; // 必須コンテナかどうか
}

/**
 * 推奨リソース設定の定数
 */
export const RECOMMENDED_RESOURCE_CONFIGS = {
  // 512 CPU / 1024 MiB 環境での最適化設定（Fargate要件準拠）
  MIGRATION_TARGET_512: {
    task: { cpu: 512, memoryMiB: 1024 },
    application: {
      name: 'EcsApp',
      cpu: 384, // 75%
      memoryReservationMiB: 768, // 75%
      memoryLimitMiB: 896, // 87.5%
      essential: true,
    },
    cloudwatchAgent: {
      name: 'cloudwatch-agent',
      cpu: 128, // 25%
      memoryReservationMiB: 128, // 12.5%
      memoryLimitMiB: 128, // 12.5%
      essential: false,
    },
  },

  // 512 CPU / 1024 MiB 環境での推奨設定（現在の設定）
  STANDARD_512: {
    task: { cpu: 512, memoryMiB: 1024 },
    application: {
      name: 'EcsApp',
      cpu: 448, // 87.5%
      memoryReservationMiB: 768, // 75%
      memoryLimitMiB: 960, // 93.75%
      essential: true,
    },
    cloudwatchAgent: {
      name: 'cloudwatch-agent',
      cpu: 64, // 12.5%
      memoryReservationMiB: 64, // 6.25%
      memoryLimitMiB: 64, // 6.25%
      essential: false,
    },
  },

  // 1024 CPU / 2048 MiB 環境での推奨設定（高負荷用）
  HIGH_PERFORMANCE_1024: {
    task: { cpu: 1024, memoryMiB: 2048 },
    application: {
      name: 'EcsApp',
      cpu: 896, // 87.5%
      memoryReservationMiB: 1536, // 75%
      memoryLimitMiB: 1792, // 87.5%
      essential: true,
    },
    cloudwatchAgent: {
      name: 'cloudwatch-agent',
      cpu: 128, // 12.5%
      memoryReservationMiB: 256, // 12.5%
      memoryLimitMiB: 256, // 12.5%
      essential: false,
    },
  },

  // 256 CPU / 512 MiB 環境での推奨設定（軽負荷用）
  LIGHTWEIGHT_256: {
    task: { cpu: 256, memoryMiB: 512 },
    application: {
      name: 'EcsApp',
      cpu: 224, // 87.5%
      memoryReservationMiB: 384, // 75%
      memoryLimitMiB: 448, // 87.5%
      essential: true,
    },
    cloudwatchAgent: {
      name: 'cloudwatch-agent',
      cpu: 32, // 12.5%
      memoryReservationMiB: 32, // 6.25%
      memoryLimitMiB: 64, // 12.5%
      essential: false,
    },
  },
} as const;

/**
 * Fargate の最小要件を検証する関数
 *
 * @param config - 検証するリソース設定
 * @returns 検証結果
 */
export const validateFargateMinimumRequirements = (
  config: FargateResourceConfig,
): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  // CPU の最小要件チェック
  if (config.cpu < 256) {
    errors.push(`CPU は最小 256 vCPU が必要です。現在の設定: ${config.cpu}`);
  }

  // メモリの最小要件チェック
  if (config.memoryMiB < 512) {
    errors.push(`メモリは最小 512 MiB が必要です。現在の設定: ${config.memoryMiB}`);
  }

  // CPU とメモリの比率チェック (1:1 から 1:8 の範囲)
  const ratio = config.memoryMiB / config.cpu;
  if (ratio < 1 || ratio > 8) {
    errors.push(`CPU とメモリの比率は 1:1 から 1:8 の範囲である必要があります。現在の比率: 1:${ratio.toFixed(2)}`);
  }

  // 有効な CPU 値のチェック
  const validCpuValues = [256, 512, 1024, 2048, 4096];
  if (!validCpuValues.includes(config.cpu)) {
    errors.push(`CPU は ${validCpuValues.join(', ')} のいずれかである必要があります。現在の設定: ${config.cpu}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * コンテナリソース配分の妥当性を検証する関数
 *
 * @param taskConfig - タスク定義のリソース設定
 * @param containers - コンテナのリソース配分設定
 * @returns 検証結果
 */
export const validateContainerResourceAllocation = (
  taskConfig: FargateResourceConfig,
  containers: ContainerResourceAllocation[],
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // CPU 配分の合計チェック
  const totalCpu = containers.reduce((sum, container) => sum + container.cpu, 0);
  if (totalCpu > taskConfig.cpu) {
    errors.push(`コンテナの CPU 配分合計 (${totalCpu}) がタスク定義の CPU (${taskConfig.cpu}) を超えています`);
  }

  // メモリ配分の合計チェック
  const totalMemoryLimit = containers.reduce((sum, container) => sum + container.memoryLimitMiB, 0);
  if (totalMemoryLimit > taskConfig.memoryMiB) {
    errors.push(
      `コンテナのメモリ上限合計 (${totalMemoryLimit}) がタスク定義のメモリ (${taskConfig.memoryMiB}) を超えています`,
    );
  }

  // 必須コンテナの存在チェック
  const essentialContainers = containers.filter((c) => c.essential);
  if (essentialContainers.length === 0) {
    errors.push('少なくとも1つの必須コンテナが必要です');
  }

  // リソース使用率の警告
  const cpuUtilization = (totalCpu / taskConfig.cpu) * 100;
  const memoryUtilization = (totalMemoryLimit / taskConfig.memoryMiB) * 100;

  if (cpuUtilization < 80) {
    warnings.push(`CPU 使用率が低すぎます (${cpuUtilization.toFixed(1)}%)。リソースの無駄遣いの可能性があります`);
  }

  if (memoryUtilization < 80) {
    warnings.push(`メモリ使用率が低すぎます (${memoryUtilization.toFixed(1)}%)。リソースの無駄遣いの可能性があります`);
  }

  // 各コンテナのメモリ予約と上限の関係チェック
  containers.forEach((container) => {
    if (container.memoryReservationMiB > container.memoryLimitMiB) {
      errors.push(
        `${container.name}: メモリ予約 (${container.memoryReservationMiB}) がメモリ上限 (${container.memoryLimitMiB}) を超えています`,
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * リソース設定のレポートを生成する関数
 *
 * @param taskConfig - タスク定義のリソース設定
 * @param containers - コンテナのリソース配分設定
 * @returns レポート文字列
 */
export const generateResourceAllocationReport = (
  taskConfig: FargateResourceConfig,
  containers: ContainerResourceAllocation[],
): string => {
  const totalCpu = containers.reduce((sum, container) => sum + container.cpu, 0);
  const totalMemoryReservation = containers.reduce((sum, container) => sum + container.memoryReservationMiB, 0);
  const totalMemoryLimit = containers.reduce((sum, container) => sum + container.memoryLimitMiB, 0);

  let report = '=== リソース配分レポート ===\n\n';

  report += `タスク定義リソース:\n`;
  report += `  CPU: ${taskConfig.cpu} vCPU\n`;
  report += `  メモリ: ${taskConfig.memoryMiB} MiB\n\n`;

  report += `コンテナ別リソース配分:\n`;
  containers.forEach((container) => {
    const cpuPercent = ((container.cpu / taskConfig.cpu) * 100).toFixed(1);
    const memoryReservationPercent = ((container.memoryReservationMiB / taskConfig.memoryMiB) * 100).toFixed(1);
    const memoryLimitPercent = ((container.memoryLimitMiB / taskConfig.memoryMiB) * 100).toFixed(1);

    report += `  ${container.name}:\n`;
    report += `    CPU: ${container.cpu} (${cpuPercent}%)\n`;
    report += `    メモリ予約: ${container.memoryReservationMiB} MiB (${memoryReservationPercent}%)\n`;
    report += `    メモリ上限: ${container.memoryLimitMiB} MiB (${memoryLimitPercent}%)\n`;
    report += `    必須: ${container.essential ? 'はい' : 'いいえ'}\n\n`;
  });

  report += `リソース使用率:\n`;
  report += `  CPU 使用率: ${((totalCpu / taskConfig.cpu) * 100).toFixed(1)}%\n`;
  report += `  メモリ予約率: ${((totalMemoryReservation / taskConfig.memoryMiB) * 100).toFixed(1)}%\n`;
  report += `  メモリ上限率: ${((totalMemoryLimit / taskConfig.memoryMiB) * 100).toFixed(1)}%\n`;

  return report;
};

/**
 * リソース設定を自動調整する関数
 *
 * @param targetConfig - 目標とするリソース設定
 * @returns 調整されたリソース配分
 */
export const adjustResourceAllocation = (
  targetConfig: 'MIGRATION_TARGET_512' | 'STANDARD_512' | 'HIGH_PERFORMANCE_1024' | 'LIGHTWEIGHT_256',
): {
  task: FargateResourceConfig;
  application: ContainerResourceAllocation;
  cloudwatchAgent: ContainerResourceAllocation;
} => {
  const config = RECOMMENDED_RESOURCE_CONFIGS[targetConfig];
  return {
    task: config.task,
    application: config.application,
    cloudwatchAgent: config.cloudwatchAgent,
  };
};

/**
 * 開発時のリソース設定検証を実行する関数
 *
 * @param taskDefinition - 検証対象のタスク定義
 */
export const validateResourceConfigurationInDevelopment = (taskDefinition: TaskDefinition): void => {
  if (process.env.CDK_DEBUG === 'true') {
    console.log('=== リソース設定検証 ===');
    console.log('CloudWatch Application Signals 移行に伴うリソース配分を検証しています...');

    // 移行目標設定との比較
    const migrationTarget = RECOMMENDED_RESOURCE_CONFIGS.MIGRATION_TARGET_512;
    console.log('\n移行目標設定 (512CPU/1024MB - 最適化版):');
    console.log(`  タスク: ${migrationTarget.task.cpu} CPU / ${migrationTarget.task.memoryMiB} MiB`);
    console.log(
      `  アプリケーション: ${migrationTarget.application.cpu} CPU / ${migrationTarget.application.memoryLimitMiB} MiB`,
    );
    console.log(
      `  CloudWatch Agent: ${migrationTarget.cloudwatchAgent.cpu} CPU / ${migrationTarget.cloudwatchAgent.memoryLimitMiB} MiB`,
    );

    console.log('\n現在の設定 (512CPU/1024MB - 従来版):');
    const current = RECOMMENDED_RESOURCE_CONFIGS.STANDARD_512;
    console.log(`  タスク: ${current.task.cpu} CPU / ${current.task.memoryMiB} MiB`);
    console.log(`  アプリケーション: ${current.application.cpu} CPU / ${current.application.memoryLimitMiB} MiB`);
    console.log(
      `  CloudWatch Agent: ${current.cloudwatchAgent.cpu} CPU / ${current.cloudwatchAgent.memoryLimitMiB} MiB`,
    );

    console.log('\n移行による変更点:');
    console.log('- タスクメモリは1024MBを維持（Fargate要件準拠）');
    console.log('- アプリケーションCPUを448→384に調整（14%削減）');
    console.log('- アプリケーションメモリを960MB→896MBに調整（7%削減）');
    console.log('- CloudWatch AgentのCPUを64→128に増加（2倍）');
    console.log('- CloudWatch Agentのメモリを64MB→128MBに増加（2倍）');
    console.log('- より安定したテレメトリ収集とリソース効率の向上を実現');
  }
};
