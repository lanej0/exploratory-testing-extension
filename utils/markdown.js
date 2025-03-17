class MarkdownGenerator {
  static generateFullReport(session) {
    const sections = [
      this.createHeader(session),
      this.createObservations(session),
      this.createSummary(session),
    ];

    return sections.join("\n\n");
  }

  static createHeader(session) {
    const startTime = new Date(session.startTime);
    return [
      "# Exploratory Testing Session Report",
      `**Session Start:** ${startTime.toLocaleString()}`,
      `**Session ID:** ${session.id}`,
    ].join("\n");
  }

  static createObservations(session) {
    if (!session.observations || session.observations.length === 0) {
      return "## Observations\n\nNo observations recorded in this session.";
    }

    const observationEntries = session.observations
      .map((obs, index) => this.createObservationEntry(obs, index + 1))
      .join("\n\n");

    return `## Observations\n\n${observationEntries}`;
  }

  static createObservationEntry(observation, index) {
    const timestamp = new Date(observation.timestamp);
    return [
      `### Observation ${index}`,
      `- **Page:** ${observation.title}`,
      `- **URL:** ${observation.url}`,
      `- **Time:** ${timestamp.toLocaleString()}`,
      "",
      observation.notes,
      "",
      `![Screenshot ${index}](screenshots/${observation.screenshotKey}.png)`,
    ].join("\n");
  }

  static createSummary(session) {
    if (!session.observations || session.observations.length === 0) {
      return "## Summary\n\nNo observations to summarize.";
    }

    // Get unique pages and count observations per page
    const pageStats = session.observations.reduce((acc, obs) => {
      const url = obs.url;
      if (!acc[url]) {
        acc[url] = {
          title: obs.title,
          count: 0,
          firstVisit: new Date(obs.timestamp),
        };
      }
      acc[url].count++;
      const timestamp = new Date(obs.timestamp);
      if (timestamp < acc[url].firstVisit) {
        acc[url].firstVisit = timestamp;
      }
      return acc;
    }, {});

    // Create summary sections
    const sections = [
      "## Summary",
      "\n### Pages Explored",
      ...Object.entries(pageStats).map(
        ([url, stats]) =>
          `- ${stats.title} (${stats.count} observation${
            stats.count === 1 ? "" : "s"
          })`
      ),
      "\n### Timeline",
      ...Object.entries(pageStats)
        .sort((a, b) => a[1].firstVisit - b[1].firstVisit)
        .map(
          ([url, stats]) =>
            `- ${stats.firstVisit.toLocaleString()}: ${stats.title}`
        ),
    ];

    return sections.join("\n");
  }
}
