const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const interviewRoutes = require('./routes/interviews');
const offerRoutes = require('./routes/offers');
const assessmentRoutes = require('./routes/assessments');
const departmentRoutes = require('./routes/departments');
const adminInviteRoutes = require('./routes/adminInvites');
const analyticsRoutes = require('./routes/analytics');
const authenticateToken = require('./middleware/authenticate');
const { startAIRetryJob } = require('./services/aiRetryJob');
const { startAllJobs } = require('./services/scheduledJobs');

const app = express();

app.use(cors());
app.use(express.json());

startAIRetryJob();
startAllJobs();


app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/admin-invites', adminInviteRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/', (req, res) => {
    res.json({
        message: 'Hyre.AI backend is running'
    });
});

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});