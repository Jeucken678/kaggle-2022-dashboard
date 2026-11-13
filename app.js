const data = window.DASHBOARD_DATA;
let focusedSkill = null;

const stageSummary = data.stageSummary;
const categorySummary = data.categorySummary;
const unlocks = data.unlockRecommendations;
const waterfall = data.waterfallTransitions;
const stages = data.stages.slice().sort((a, b) => a.order - b.order);

const jobSelect = document.getElementById("job-select");
const stageSelect = document.getElementById("stage-select");
const heroSubtitle = document.getElementById("hero-subtitle");
const stageNote = document.getElementById("stage-note");
const nextStageLabel = document.getElementById("next-stage-label");
const stagePath = document.getElementById("stage-path");
const unlockList = document.getElementById("unlock-list");
const categoryGrid = document.getElementById("category-grid");
const waterfallBoard = document.getElementById("waterfall-board");
const waterfallCaption = document.getElementById("waterfall-caption");

function percentage(value) {
  return `${Number(value).toFixed(1)}%`;
}

// Keep legacy data keys stable for the existing CSV / BI exports.
function displayStage(key) {
  return { "0-1年": "不足1年", "2-4年": "1–5年", "5-10年": "5–10年", "10年以上": "10年以上" }[key] || key;
}

function points(value) {
  return `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(1)} 个百分点`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function stageOrder(label) {
  const match = stages.find((stage) => stage.label === label);
  return match ? match.order : 0;
}

function getNextStage(label) {
  const currentOrder = stageOrder(label);
  return stages.find((stage) => stage.order === currentOrder + 1)?.label || null;
}

function uniqueJobs() {
  return data.jobs;
}

function selectedJob() {
  return jobSelect.value;
}

function selectedStage() {
  return stageSelect.value;
}

function recordsForJob(job) {
  return stageSummary.filter((record) => record.job_title === job);
}

function stageBlock(job, stageLabel) {
  return recordsForJob(job).filter((record) => record.exp_stage === stageLabel);
}

function stageCategories(job, stageLabel) {
  return categorySummary.filter(
    (record) => record.job_title === job && record.exp_stage === stageLabel
  );
}

function currentUnlocks(job, stageLabel) {
  return unlocks
    .filter(
      (record) =>
        record.job_title === job && record.current_stage === stageLabel
    )
    .sort((a, b) => a.unlock_rank - b.unlock_rank);
}

function currentWaterfall(job, stageLabel) {
  return waterfall.filter(
    (record) => record.job_title === job && record.current_stage === stageLabel
  );
}

function topSkillsForStage(job, stageLabel, limit = 5) {
  return stageBlock(job, stageLabel)
    .slice()
    .sort((a, b) => b.penetration_rate - a.penetration_rate)
    .slice(0, limit);
}

function buildCategoryBars(job, stageLabel) {
  const rows = stageCategories(job, stageLabel)
    .slice()
    .sort((a, b) => b.avg_penetration_rate - a.avg_penetration_rate);

  return rows
    .map(
      (row) => `
        <div>
          <div class="category-bar-label">
            <span>${row.skill_category_label}</span>
            <span>${percentage(row.avg_penetration_rate)}</span>
          </div>
          <div class="category-bar-track">
            <div class="category-bar-fill" style="width:${Math.max(row.avg_penetration_rate, 2)}%"></div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderStagePath(job, activeStage) {
  const nextStage = getNextStage(activeStage);
  stagePath.innerHTML = stages
    .map((stage) => {
      const topSkills = topSkillsForStage(job, stage.label);
      const stageStats = stageBlock(job, stage.label);
      if (!stageStats.length) {
        return `
          <article class="stage-card">
            <h3 class="stage-title">${displayStage(stage.label)}</h3>
            <p class="stage-meta">该职位在这个阶段暂无足够样本。</p>
            <div class="empty-state">没有可展示的工具使用率数据。</div>
          </article>
        `;
      }

      const totalPeople = stageStats[0].total_people;
      const sourceStage = stageStats[0].source_stage_members;
      const cardClass = [
        "stage-card",
        stage.label === activeStage ? "active" : "",
        stage.label === nextStage ? "future" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <article class="${cardClass}">
          <h3 class="stage-title">${displayStage(stage.label)}</h3>
          <p class="stage-meta">${escapeHtml(sourceStage)} · ${totalPeople} 位样本${totalPeople < 30 ? " · 样本较少" : ""}</p>
          ${focusedSkill ? (() => {
            const evidence = findSkill(job, stage.label, focusedSkill);
            return `<p class="focused-skill">关注工具 · ${escapeHtml(focusedSkill)}<br /><strong>${evidence ? percentage(evidence.penetration_rate) : "暂无数据"}</strong></p>`;
          })() : ""}
          <div class="skill-chip-row">
            ${topSkills
              .map(
                (skill) =>
                  `<span class="skill-chip">${skill.skill_label} ${percentage(
                    skill.penetration_rate
                  )}</span>`
              )
              .join("")}
          </div>
          <div class="category-stack">
            ${buildCategoryBars(job, stage.label)}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderUnlocks(job, stageLabel) {
  const rows = currentUnlocks(job, stageLabel);
  const nextStage = getNextStage(stageLabel);
  nextStageLabel.textContent = nextStage ? displayStage(nextStage) : "无后续对照组";

  if (!rows.length) {
    unlockList.innerHTML = `
      <div class="empty-state">
        当前组没有后续对照组，或没有符合条件的正差值工具。
      </div>
    `;
    return;
  }

  unlockList.innerHTML = rows
    .map(
      (row) => `
        <article class="unlock-card">
          <span class="unlock-rank">#${row.unlock_rank}</span>
          <div class="unlock-category">${row.skill_category_label}</div>
          <h3 class="unlock-title">${row.skill_label}</h3>
          <p class="section-copy">
            同岗位 <strong>${displayStage(row.next_stage)}</strong> 组与 <strong>${displayStage(row.current_stage)}</strong> 组相比，
            该工具使用率更高。
          </p>
          <div class="unlock-metrics">
            <span class="metric-pill">当前组 ${percentage(row.current_penetration)}</span>
            <span class="metric-pill">对照组 ${percentage(row.next_penetration)}</span>
            <span class="metric-pill">差值 ${points(row.delta_penetration)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderCategoryTrend(job) {
  const rows = categorySummary.filter((record) => record.job_title === job);
  const grouped = {};

  rows.forEach((row) => {
    if (!grouped[row.skill_category]) {
      grouped[row.skill_category] = {
        label: row.skill_category_label,
        values: {},
      };
    }
    grouped[row.skill_category].values[row.exp_stage] = row.avg_penetration_rate;
  });

  categoryGrid.innerHTML = Object.keys(grouped)
    .map((key) => {
      const group = grouped[key];
      return `
        <article class="category-trend-card">
          <strong>${group.label}</strong>
          <div class="trend-values">
            ${stages
              .map((stage) => {
                const value = group.values[stage.label];
                return `
                  <div class="trend-cell">
                    <span>${displayStage(stage.label)}</span>
                    <strong>${value == null ? "暂无数据" : percentage(value)}</strong>
                  </div>
                `;
              })
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderWaterfall(job, stageLabel) {
  const rows = currentWaterfall(job, stageLabel);
  const nextStage = getNextStage(stageLabel);

  if (!rows.length || !nextStage) {
    waterfallCaption.textContent = "当前组没有可比较的后续经验组。";
    waterfallBoard.innerHTML = `
      <div class="empty-state">没有可展示的组间差异。</div>
    `;
    return;
  }

  waterfallCaption.textContent = `${job}：${displayStage(stageLabel)} 与 ${displayStage(nextStage)} 组比较。`;

  const gains = rows
    .filter((row) => row.delta_penetration > 0)
    .sort((a, b) => b.delta_penetration - a.delta_penetration)
    .slice(0, 5);

  const losses = rows
    .filter((row) => row.delta_penetration < 0)
    .sort((a, b) => a.delta_penetration - b.delta_penetration)
    .slice(0, 5);

  const compared = [...losses, ...gains];
  const maxAbsDelta = Math.max(...compared.map((row) => Math.abs(row.delta_penetration)), 1);
  waterfallBoard.innerHTML = compared.length ? compared.map((row) => {
    const positive = row.delta_penetration > 0;
    const width = Math.abs(row.delta_penetration) / maxAbsDelta * 100;
    const bar = `<div class="bar-fill ${positive ? "positive" : "negative"}" style="width:${width}%"></div>`;
    return `<div class="waterfall-row">
      <div class="bar-side left"><div class="bar-track"></div>${positive ? "" : bar}</div>
      <div class="bar-label">
        <div class="bar-skill">${escapeHtml(row.skill_label.trim())}</div>
        <div class="bar-delta">${positive ? "较高" : "较低"} · ${points(row.delta_penetration)}</div>
        <div class="bar-delta">${percentage(row.current_penetration)} → ${percentage(row.next_penetration)}</div>
      </div>
      <div class="bar-side"><div class="bar-track"></div>${positive ? bar : ""}</div>
    </div>`;
  }).join("") : '<div class="empty-state">两组工具使用率无差异。</div>';
}

function renderHero() {
  heroSubtitle.textContent = data.meta.subtitle;
  stageNote.textContent = data.meta.stage_note;
}

function refresh() {
  const job = selectedJob();
  const stage = selectedStage();
  renderStagePath(job, stage);
  renderUnlocks(job, stage);
  renderCategoryTrend(job);
  renderWaterfall(job, stage);
  renderSelectionInsight(job, stage);
}

function initSelectors() {
  jobSelect.innerHTML = uniqueJobs()
    .map((job) => `<option value="${job}">${job}</option>`)
    .join("");

  stageSelect.innerHTML = stages
    .map((stage) => `<option value="${stage.label}">${displayStage(stage.label)}</option>`)
    .join("");

  jobSelect.value = "Data Scientist";
  stageSelect.value = "2-4年";
}

function initEvents() {
  const onSelectionChange = () => { focusedSkill = null; refresh(); };
  jobSelect.addEventListener("change", onSelectionChange);
  stageSelect.addEventListener("change", onSelectionChange);
}

renderHero();
renderOverview();
initSelectors();
initEvents();
refresh();

function findSkill(job, stage, skill) {
  return stageBlock(job, stage).find((row) => row.skill_label.trim() === skill);
}

function renderOverview() {
  const groups = new Map(stageSummary.map((row) => [`${row.job_title}|${row.exp_stage}`, row.total_people]));
  const total = [...groups.values()].reduce((sum, count) => sum + count, 0);
  const metrics = [[total.toLocaleString("en-US"), "分析样本"], [data.jobs.length, "岗位类别"], [stages.length, "编程经验组"], [Object.keys(data.meta.categories).length, "技术栈类别"]];
  document.getElementById("project-stats").innerHTML = metrics.map(([number, label]) => `<div><strong>${number}</strong><span>${label}</span></div>`).join("");

  const scientist = "Data Scientist";
  const analyst = data.jobs.find((job) => job.startsWith("Data Analyst"));
  const pythonRows = stages.slice(1).map((stage) => findSkill(scientist, stage.label, "Python"));
  const analystSql = findSkill(analyst, "5-10年", "SQL");
  const scientistSql = findSkill(scientist, "5-10年", "SQL");
  const awsEarly = findSkill(scientist, "0-1年", "Amazon Web Services (AWS)");
  const awsLate = findSkill(scientist, "10年以上", "Amazon Web Services (AWS)");
  const findings = [
    {
      skill: "Python",
      title: "Python 在多个数据科学家经验组中保持高使用率",
      metric: pythonRows.every(Boolean) ? `${percentage(Math.min(...pythonRows.map((row) => row.penetration_rate)))}+` : "暂无数据",
      label: "三个经验组中的最低使用率",
      evidence: pythonRows.every(Boolean) ? pythonRows.map((row) => `${displayStage(row.exp_stage)}：${percentage(row.penetration_rate)}（n=${row.total_people}）`).join("；") + "。" : "缺少可比较的 Python 记录。",
      note: "基础工具在较高经验组中同样常见。",
      actions: [{label: "查看数据科学家", job: scientist, stage: "2-4年"}],
    },
    {
      skill: "SQL",
      title: "SQL 在数据分析师群体中具有突出地位",
      metric: analystSql ? percentage(analystSql.penetration_rate) : "暂无数据",
      label: "5–10年组 · 数据分析师 SQL 使用率",
      evidence: analystSql && scientistSql ? `同为 5–10年编程经验，数据分析师为 ${percentage(analystSql.penetration_rate)}（n=${analystSql.total_people}），数据科学家为 ${percentage(scientistSql.penetration_rate)}（n=${scientistSql.total_people}）。` : "缺少可比较的 SQL 记录。",
      note: "同一工具的使用情况也存在岗位差异。",
      actions: [{label: "查看数据分析师", job: analyst, stage: "5-10年"}, {label: "对照数据科学家", job: scientist, stage: "5-10年"}],
    },
    {
      skill: "Amazon Web Services (AWS)",
      title: "云平台使用存在明显的经验组差异",
      metric: awsEarly && awsLate ? `${percentage(awsEarly.penetration_rate)} → ${percentage(awsLate.penetration_rate)}` : "暂无数据",
      label: "数据科学家 · AWS 使用率",
      evidence: awsEarly && awsLate ? `不足1年组（n=${awsEarly.total_people}）与10年以上组（n=${awsLate.total_people}）相差 ${Math.abs(awsLate.penetration_rate - awsEarly.penetration_rate).toFixed(1)} 个百分点。` : "缺少可比较的 AWS 记录。",
      note: "这描述群体差异，不能推断个人使用轨迹。",
      actions: [{label: "查看云平台对比", job: scientist, stage: "0-1年"}],
    },
  ];
  const grid = document.getElementById("findings-grid");
  grid.innerHTML = findings.map((finding, index) => `<article class="finding-card">
    <p class="finding-number">0${index + 1} / 发现</p>
    <h3>${finding.title}</h3>
    <strong class="finding-metric">${finding.metric}</strong>
    <p class="finding-label">${finding.label}</p>
    <p class="finding-evidence">${finding.evidence}</p>
    <p class="finding-note">${finding.note}</p>
    <div class="finding-actions">${finding.actions.map((action, actionIndex) => `<button type="button" data-finding="${index}" data-action="${actionIndex}">${action.label} ↗</button>`).join("")}</div>
  </article>`).join("");
  grid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-finding]");
    if (!button) return;
    const action = findings[Number(button.dataset.finding)].actions[Number(button.dataset.action)];
    focusedSkill = findings[Number(button.dataset.finding)].skill;
    jobSelect.value = action.job;
    stageSelect.value = action.stage;
    refresh();
    const target = document.getElementById("skill-path");
    target.focus({preventScroll: true});
    target.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
  });
}

function renderSelectionInsight(job, stage) {
  const current = stageBlock(job, stage);
  const nextStage = getNextStage(stage);
  const next = nextStage ? stageBlock(job, nextStage) : [];
  const target = document.getElementById("selection-insight");
  if (!current.length) {
    target.textContent = "当前岗位与经验组暂无数据，请选择其他分组。";
    return;
  }
  const people = current[0].total_people;
  let description = `${job} · ${displayStage(stage)}组有 ${people} 人。`;
  if (!next.length) {
    const leading = topSkillsForStage(job, stage, 1)[0];
    description += `当前无后续对照组；本组使用率最高的工具为 ${leading.skill_label.trim()}（${percentage(leading.penetration_rate)}）。可在下方横向查看各组。`;
  } else {
    description += `相邻的${displayStage(nextStage)}组有 ${next[0].total_people} 人。`;
    const candidate = currentUnlocks(job, stage)[0];
    if (candidate) {
      description += `${candidate.skill_label.trim()} 使用率分别为 ${percentage(candidate.current_penetration)} 和 ${percentage(candidate.next_penetration)}，对照组高 ${Number(candidate.delta_penetration).toFixed(1)} 个百分点，是当前排序下值得关注的工具。`;
    } else {
      description += "当前没有符合 Top 3 条件的正差值工具，可查看下方完整组间对比。";
    }
  }
  if (people < 30 || (next.length && next[0].total_people < 30)) {
    description += " 当前或对照组少于 30 人，比例容易受少数样本影响，请谨慎解读。";
  }
  target.textContent = description;
}
