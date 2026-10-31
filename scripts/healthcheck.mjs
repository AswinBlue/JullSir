// scripts/healthcheck.mjs
// JullSir Multi-Project Supabase Healthcheck & Email Reporter

import fs from 'node:fs';
import path from 'node:path';

// 1. Projects to check
const projects = [];

// Primary project: JullSir
const primaryUrl = process.env.VITE_SUPABASE_URL;
const primaryKey = process.env.VITE_SUPABASE_ANON_KEY;
if (primaryUrl && primaryKey && !primaryUrl.includes('your-project-id')) {
  projects.push({
    name: 'JullSir (줄서)',
    url: primaryUrl.replace(/\/$/, ''),
    anonKey: primaryKey,
  });
}

// Additional projects from JSON environment variable (GitHub Secrets)
const additionalJson = process.env.ADDITIONAL_PROJECTS_JSON;
if (additionalJson) {
  try {
    const parsed = JSON.parse(additionalJson);
    if (Array.isArray(parsed)) {
      projects.push(...parsed);
    }
  } catch (err) {
    console.warn('[WARN] Failed to parse ADDITIONAL_PROJECTS_JSON:', err.message);
  }
}

// Check if config file exists
const configPath = path.resolve('config/healthcheck-projects.json');
if (fs.existsSync(configPath)) {
  try {
    const fileContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (Array.isArray(fileContent)) {
      for (const p of fileContent) {
        if (!projects.some(existing => existing.url === p.url)) {
          projects.push(p);
        }
      }
    }
  } catch (err) {
    console.warn('[WARN] Failed to read config/healthcheck-projects.json:', err.message);
  }
}

if (projects.length === 0) {
  console.log('[INFO] No Supabase projects configured for healthcheck.');
  process.exit(0);
}

console.log(`[INFO] Starting weekly healthcheck for ${projects.length} project(s)...`);

const results = [];

for (const proj of projects) {
  const startTime = Date.now();
  let status = 'UNKNOWN';
  let message = '';
  let latencyMs = 0;

  try {
    // Supabase REST API query on queues table (or root) to trigger DB activity
    const endpoint = `${proj.url}/rest/v1/queues?select=id&limit=1`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': proj.anonKey,
        'Authorization': `Bearer ${proj.anonKey}`,
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    latencyMs = Date.now() - startTime;

    if (res.ok) {
      status = 'HEALTHY';
      message = `HTTP ${res.status} OK`;
    } else {
      status = 'UNHEALTHY';
      const text = await res.text();
      message = `HTTP ${res.status}: ${text.slice(0, 100)}`;
    }
  } catch (err) {
    latencyMs = Date.now() - startTime;
    status = 'ERROR';
    message = err instanceof Error ? err.message : String(err);
  }

  results.push({
    name: proj.name,
    url: proj.url,
    status,
    latencyMs,
    message,
  });

  console.log(`[${status}] ${proj.name} (${latencyMs}ms) - ${message}`);
}

// 2. Generate Report HTML & Markdown
const checkDate = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
const allHealthy = results.every(r => r.status === 'HEALTHY');

const tableRowsHtml = results.map(r => `
  <tr style="border-bottom: 1px solid #e2e8f0;">
    <td style="padding: 12px; font-weight: bold; color: #1e293b;">${r.name}</td>
    <td style="padding: 12px;">
      <span style="display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; background-color: ${r.status === 'HEALTHY' ? '#dcfce7' : '#fee2e2'}; color: ${r.status === 'HEALTHY' ? '#15803d' : '#b91c1c'};">
        ${r.status === 'HEALTHY' ? '정상 (Active)' : '점검 필요 (Check)'}
      </span>
    </td>
    <td style="padding: 12px; font-family: monospace; color: #475569;">${r.latencyMs} ms</td>
    <td style="padding: 12px; font-size: 12px; color: #64748b;">${r.message}</td>
  </tr>
`).join('');

const emailHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
  <div style="margin-bottom: 20px;">
    <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px;">
      ${allHealthy ? '✅' : '⚠️'} Supabase 주간 헬스체크 통합 리포트
    </h2>
    <p style="color: #64748b; font-size: 13px; margin: 0;">
      측정 시각: ${checkDate} (자동 휴면 방지 쿼리 완료)
    </p>
  </div>

  <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; margin-bottom: 24px;">
    <thead>
      <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
        <th style="padding: 10px 12px; color: #475569;">프로젝트</th>
        <th style="padding: 10px 12px; color: #475569;">상태</th>
        <th style="padding: 10px 12px; color: #475569;">응답 속도</th>
        <th style="padding: 10px 12px; color: #475569;">결과</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div style="padding: 16px; background-color: #f1f5f9; border-radius: 12px; font-size: 12px; color: #475569; line-height: 1.6;">
    <strong>ℹ️ 헬스체크 효과:</strong><br>
    본 스케줄러를 통해 등록된 모든 데이터베이스에 주 1회 쿼리가 전송되어 Supabase Free Tier의 <strong>7일 비활성 자동 슬립(Inactivity Pause)</strong>이 영구히 방지됩니다.
  </div>
</div>
`;

// Markdown for GitHub Actions Job Summary
const markdownTable = [
  '| 프로젝트 | 상태 | 응답 속도 | 결과 |',
  '| :--- | :--- | :--- | :--- |',
  ...results.map(r => `| **${r.name}** | ${r.status === 'HEALTHY' ? '🟢 정상 (Active)' : '🔴 실패'} | \`${r.latencyMs}ms\` | ${r.message} |`),
].join('\n');

const stepSummary = `
## ${allHealthy ? '✅' : '⚠️'} Supabase 주간 헬스체크 리포트 (${checkDate})

${markdownTable}

> **휴면 방지 완료**: 주 1회 활성 쿼리가 데이터베이스에 전송되어 Supabase Free 프로젝트의 7일 비활성 슬립이 방지되었습니다.
`;

if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, stepSummary);
  } catch (err) {
    // ignore
  }
}

// 3. Send unified email report via Resend
const resendApiKey = process.env.RESEND_API_KEY;
const recipientEmail = process.env.REPORT_EMAIL || process.env.ADMIN_EMAIL;

if (resendApiKey && recipientEmail) {
  console.log(`[INFO] Sending unified healthcheck report to ${recipientEmail}...`);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'JullSir System <onboarding@resend.dev>',
        to: [recipientEmail],
        subject: `[JullSir] ${allHealthy ? '✅ 정상' : '⚠️ 점검 필요'} Supabase 주간 헬스체크 통합 리포트`,
        html: emailHtml,
      }),
    });

    if (res.ok) {
      console.log('[SUCCESS] Email report successfully sent via Resend!');
    } else {
      const errText = await res.text();
      console.warn(`[WARN] Failed to send email via Resend: HTTP ${res.status} - ${errText}`);
    }
  } catch (err) {
    console.warn('[WARN] Email delivery error:', err.message);
  }
} else {
  console.log('[INFO] RESEND_API_KEY or REPORT_EMAIL not set. Skipping email delivery (summary available in Actions).');
}
