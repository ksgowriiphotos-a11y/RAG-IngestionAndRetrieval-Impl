// Healthcare-specific sample stories
db = db.getSiblingDB('rag_userstories');

const healthcareStories = [
    {
        content: "As a healthcare provider, I want to view patient vitals on the dashboard so that I can quickly assess their current health status.",
        metadata: {
            description: "A comprehensive dashboard view showing real-time patient vital signs and health metrics.",
            acceptanceCriteria: [
                "Display blood pressure, heart rate, temperature, and oxygen levels",
                "Show trending data over time",
                "Highlight abnormal values",
                "Update in real-time"
            ],
            epic: "Healthcare Dashboard",
            sprint: "Sprint 1",
            points: 8,
            priority: "high",
            status: "completed",
            assignee: "Dr. Smith",
            createdDate: new Date().toISOString()
        },
        embedding: Array(384).fill(0).map(() => Math.random() - 0.5)
    },
    {
        content: "As a patient, I want to access my medical records through the healthcare dashboard so that I can track my health history.",
        metadata: {
            description: "Patient portal showing comprehensive medical history and records.",
            acceptanceCriteria: [
                "Display past appointments and diagnoses",
                "Show medication history",
                "List lab results with normal ranges",
                "Provide downloadable medical reports"
            ],
            epic: "Healthcare Dashboard",
            sprint: "Sprint 2",
            points: 5,
            priority: "high",
            status: "completed",
            assignee: "Jane Wilson",
            createdDate: new Date().toISOString()
        },
        embedding: Array(384).fill(0).map(() => Math.random() - 0.5)
    },
    {
        content: "As a nurse, I want a unified healthcare dashboard so that I can manage patient care efficiently.",
        metadata: {
            description: "Centralized dashboard for nurses to manage patient care and tasks.",
            acceptanceCriteria: [
                "Show patient list with priority indicators",
                "Display upcoming medications and treatments",
                "Provide quick access to patient notes",
                "Include task management system"
            ],
            epic: "Healthcare Dashboard",
            sprint: "Sprint 2",
            points: 8,
            priority: "high",
            status: "in-progress",
            assignee: "Nurse Johnson",
            createdDate: new Date().toISOString()
        },
        embedding: Array(384).fill(0).map(() => Math.random() - 0.5)
    },
    {
        content: "As an administrator, I want to see healthcare analytics on the dashboard so that I can monitor facility performance.",
        metadata: {
            description: "Analytics dashboard showing key performance indicators for healthcare facility.",
            acceptanceCriteria: [
                "Display department utilization rates",
                "Show patient satisfaction scores",
                "Track average wait times",
                "Generate performance reports"
            ],
            epic: "Healthcare Dashboard",
            sprint: "Sprint 3",
            points: 13,
            priority: "medium",
            status: "not-started",
            assignee: "Admin Team",
            createdDate: new Date().toISOString()
        },
        embedding: Array(384).fill(0).map(() => Math.random() - 0.5)
    },
    {
        content: "As a doctor, I want a customizable healthcare dashboard so that I can prioritize relevant patient information.",
        metadata: {
            description: "Configurable dashboard allowing doctors to customize their view of patient data.",
            acceptanceCriteria: [
                "Allow widget rearrangement",
                "Provide customizable alerts",
                "Enable/disable specific metrics",
                "Save layout preferences"
            ],
            epic: "Healthcare Dashboard",
            sprint: "Sprint 4",
            points: 8,
            priority: "medium",
            status: "not-started",
            assignee: "Dr. Johnson",
            createdDate: new Date().toISOString()
        },
        embedding: Array(384).fill(0).map(() => Math.random() - 0.5)
    }
];

// Insert the healthcare stories if they don't exist
healthcareStories.forEach(story => {
    db.stories.updateOne(
        { content: story.content },
        { $set: story },
        { upsert: true }
    );
});

print("Healthcare stories inserted successfully!");