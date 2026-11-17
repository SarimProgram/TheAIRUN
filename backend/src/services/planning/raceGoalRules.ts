type RaceGoalPreferences = {
    hasRaceGoal?: boolean | null;
    runGoal?: string | null;
    trainingStyle?: string | null;
};

export function canIncludeGoalPracticeRuns(plan: RaceGoalPreferences): boolean {
    return plan.hasRaceGoal === true && ['5k', '10k', 'halfMarathon'].includes(plan.runGoal ?? '');
}

/** Replace unsolicited race rehearsals without changing session counts, distances or daily goals. */
export function enforceRaceGoalRules(table: any[], plan: RaceGoalPreferences): any[] {
    if (canIncludeGoalPracticeRuns(plan)) return table;
    const styles = new Set((plan.trainingStyle ?? '').split(',').map(style => style.trim()));
    const replacement = styles.has('walkOnly') && !styles.has('runOnly') && !styles.has('walkAndRun') ? 'Walk' : 'Easy Run';
    return table.map(week => {
        const dailys = week?.['Week Dailys'];
        if (!Array.isArray(dailys?.runs)) return week;
        return { ...week, 'Week Dailys': { ...dailys, runs: dailys.runs.map((run: any) =>
            run?.runType === 'Goal Practice Run' ? { ...run, runType: replacement } : run) } };
    });
}
