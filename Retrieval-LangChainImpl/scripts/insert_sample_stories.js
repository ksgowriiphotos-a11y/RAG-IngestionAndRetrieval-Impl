// Sample data insertion script
db = db.getSiblingDB('rag_userstories');

// Sample user stories with metadata
const sampleStories = [
    {
        content: "As a user, I want to reset my password so that I can regain access to my account if I forget it.",
        metadata: {
            description: "This feature allows users to securely reset their passwords through email verification.",
            acceptanceCriteria: [
                "User can request password reset via email",
                "Reset link is sent to registered email",
                "Link expires after 24 hours",
                "Password must meet security requirements"
            ],
            epic: "User Authentication",
            sprint: "Sprint 2",
            points: 5,
            priority: "high",
            status: "completed",
            assignee: "John Doe",
            createdDate: new Date().toISOString()
        },
        embedding: Array(384).fill(0).map(() => Math.random() - 0.5) // Random embedding for demo
    },
    {
        content: "As a product owner, I want to track user story progress so that I can monitor project velocity.",
        metadata: {
            description: "A dashboard showing the progress of user stories across different sprints and epics.",
            acceptanceCriteria: [
                "View story status in real-time",
                "Filter stories by epic/sprint",
                "Show completion percentage",
                "Display story points distribution"
            ],
            epic: "Project Management",
            sprint: "Sprint 3",
            points: 8,
            priority: "medium",
            status: "in-progress",
            assignee: "Jane Smith",
            createdDate: new Date().toISOString()
        },
        embedding: Array(384).fill(0).map(() => Math.random() - 0.5)
    }
];

// Insert the sample stories if they don't exist
sampleStories.forEach(story => {
    db.stories.updateOne(
        { content: story.content },
        { $set: story },
        { upsert: true }
    );
});