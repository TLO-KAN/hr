import fs from 'fs';
import leaveRequestService from '../src/services/leaveRequestService.js';
import { getPool } from '../src/config/db-pool.js';

const pool = getPool();

async function run() {
  let exitCode = 0;
  try {
    const summary = await leaveRequestService.getNotificationFlowHealthSummary();

    const report = {
      generated_at: new Date().toISOString(),
      component: 'notification-flow',
      status: summary.healthy ? 'healthy' : 'unhealthy',
      strict_mode: summary.strict_mode,
      first_step_only: summary.first_step_only,
      workflow_count: summary.workflow_count,
      issue_count: summary.issues.length,
      issues: summary.issues,
      checks: summary.checks,
    };

    const output = JSON.stringify(report, null, 2);
    console.log(output);

    const reportPath = process.env.NOTIFICATION_FLOW_REPORT_PATH;
    if (reportPath) {
      fs.writeFileSync(reportPath, `${output}\n`, 'utf8');
      console.log(`Report written to ${reportPath}`);
    }

    if (!summary.healthy) {
      exitCode = 1;
    }
  } catch (error) {
    const failure = {
      generated_at: new Date().toISOString(),
      component: 'notification-flow',
      status: 'error',
      error: error?.message || String(error),
    };

    console.error(JSON.stringify(failure, null, 2));
    exitCode = 1;
  } finally {
    await pool.end();
  }

  process.exit(exitCode);
}

run();
