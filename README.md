# Dashboard 使用说明

## 本地网页端

直接打开 [index.html](/Users/yanzuwu/VS%20Code%20Project/dashboard_site/index.html) 即可查看静态 Dashboard。

## BI 导入文件

将以下 CSV 导入 Tableau 或 Power BI：

- [dashboard_skill_stage_summary.csv](/Users/yanzuwu/VS%20Code%20Project/dashboard_exports/dashboard_skill_stage_summary.csv)
- [dashboard_skill_category_summary.csv](/Users/yanzuwu/VS%20Code%20Project/dashboard_exports/dashboard_skill_category_summary.csv)
- [dashboard_unlock_recommendations.csv](/Users/yanzuwu/VS%20Code%20Project/dashboard_exports/dashboard_unlock_recommendations.csv)
- [dashboard_skill_transition_waterfall.csv](/Users/yanzuwu/VS%20Code%20Project/dashboard_exports/dashboard_skill_transition_waterfall.csv)

## 口径说明

- `2-4年` 是由原始问卷中的 `1-3 years` 与 `3-5 years` 聚合得到的近似阶段。
- `10年以上` 是由 `10-20 years` 与 `20+ years` 聚合得到的近似阶段。
- 当前版本的“技能解锁”逻辑基于同职位下相邻经验阶段的渗透率增量。
