"use strict";
/**
 * Performance Monitor
 *
 * Comprehensive performance monitoring for ensemble orchestration including
 * SLA enforcement, real-time metrics collection, and alerting for violations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMonitor = exports.ViolationSeverity = exports.SLAViolationType = void 0;
var SLAViolationType;
(function (SLAViolationType) {
    SLAViolationType["RESPONSE_TIME"] = "response_time";
    SLAViolationType["SUCCESS_RATE"] = "success_rate";
    SLAViolationType["COST"] = "cost";
    SLAViolationType["CONFIDENCE"] = "confidence";
    SLAViolationType["PARALLEL_EFFICIENCY"] = "parallel_efficiency";
})(SLAViolationType || (exports.SLAViolationType = SLAViolationType = {}));
var ViolationSeverity;
(function (ViolationSeverity) {
    ViolationSeverity["CRITICAL"] = "critical";
    ViolationSeverity["HIGH"] = "high";
    ViolationSeverity["MEDIUM"] = "medium";
    ViolationSeverity["LOW"] = "low";
})(ViolationSeverity || (exports.ViolationSeverity = ViolationSeverity = {}));
/**
 * Performance Monitor Implementation
 */
class PerformanceMonitor {
    constructor(config) {
        this.metricsHistory = [];
        this.activeAlerts = new Map();
        this.requestHistory = [];
        this.alertCooldowns = new Map();
        this.startTime = new Date();
        this.config = config;
        this.startPerformanceCollection();
    }
    /**
     * Records a completed ensemble request for performance analysis
     */
    recordEnsembleRequest(request, response, duration) {
        const record = {
            id: response.id,
            timestamp: new Date(),
            duration,
            success: true,
            providersUsed: response.metadata.providersSuccessful.length,
            providersFailed: response.metadata.providersFailed.length,
            cost: response.metadata.costBreakdown.total,
            confidence: response.confidence,
            parallelEfficiency: response.metadata.performance.parallelEfficiency,
            individualResponses: response.individual
        };
        this.requestHistory.push(record);
        this.trimRequestHistory();
        // Check for SLA violations
        this.checkSLAViolations(record);
        console.log(`📊 Recorded ensemble request ${response.id}: ${duration}ms, confidence: ${response.confidence.toFixed(2)}`);
    }
    /**
     * Records a failed ensemble request
     */
    recordEnsembleFailure(request, error, duration) {
        const record = {
            id: `failed-${Date.now()}`,
            timestamp: new Date(),
            duration,
            success: false,
            providersUsed: 0,
            providersFailed: request.providers?.length || 0,
            cost: 0,
            confidence: 0,
            parallelEfficiency: 0,
            error: error.message,
            individualResponses: []
        };
        this.requestHistory.push(record);
        this.trimRequestHistory();
        // Always create alert for failures
        this.createAlert({
            type: SLAViolationType.SUCCESS_RATE,
            severity: ViolationSeverity.HIGH,
            metric: 'ensemble_failure',
            threshold: 1.0,
            actualValue: 0.0,
            message: `Ensemble request failed: ${error.message}`,
            affectedRequests: 1
        });
        console.error(`📊 Recorded ensemble failure: ${error.message} (${duration}ms)`);
    }
    /**
     * Gets current performance metrics
     */
    getCurrentMetrics() {
        const now = new Date();
        const recentRequests = this.getRecentRequests(60000); // Last minute
        const ensembleMetrics = this.calculateEnsembleMetrics(recentRequests);
        const providerMetrics = this.calculateProviderMetrics(recentRequests);
        const systemMetrics = this.calculateSystemMetrics();
        const slaCompliance = this.calculateSLACompliance(recentRequests);
        return {
            timestamp: now,
            ensembleMetrics,
            providerMetrics,
            systemMetrics,
            slaCompliance
        };
    }
    /**
     * Gets performance dashboard data
     */
    getDashboard() {
        const currentMetrics = this.getCurrentMetrics();
        const recentRequests = this.getRecentRequests(300000); // Last 5 minutes
        const overview = {
            status: this.determineSystemStatus(currentMetrics),
            uptime: (Date.now() - this.startTime.getTime()) / 1000,
            totalRequests: this.requestHistory.length,
            averageResponseTime: currentMetrics.ensembleMetrics.averageResponseTime,
            successRate: currentMetrics.ensembleMetrics.successfulRequests /
                Math.max(currentMetrics.ensembleMetrics.totalRequests, 1),
            costEfficiency: this.calculateCostEfficiency(recentRequests)
        };
        const realTimeMetrics = {
            currentThroughput: this.calculateThroughput(recentRequests),
            activeRequests: 0, // Would be tracked separately in production
            queueDepth: 0, // Would be tracked separately in production
            responseTimeDistribution: this.calculateResponseTimeDistribution(recentRequests),
            errorRateByProvider: this.calculateErrorRateByProvider(recentRequests)
        };
        const trends = this.calculateTrends();
        const alerts = this.getAlertSummary();
        const providerComparison = this.getProviderComparison(currentMetrics);
        return {
            overview,
            realTimeMetrics,
            trends,
            alerts,
            providerComparison
        };
    }
    /**
     * Forces an SLA check on current performance
     */
    checkSLACompliance() {
        const recentRequests = this.getRecentRequests(60000);
        return this.calculateSLACompliance(recentRequests);
    }
    /**
     * Gets all active alerts
     */
    getActiveAlerts() {
        return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
    }
    /**
     * Resolves an alert
     */
    resolveAlert(alertId) {
        const alert = this.activeAlerts.get(alertId);
        if (alert && !alert.resolved) {
            alert.resolved = true;
            alert.resolvedAt = new Date();
            console.log(`🔔 Resolved alert ${alertId}: ${alert.message}`);
            return true;
        }
        return false;
    }
    /**
     * Starts automatic performance data collection
     */
    startPerformanceCollection() {
        if (!this.config.metricsCollection.enabled)
            return;
        setInterval(() => {
            const metrics = this.getCurrentMetrics();
            this.metricsHistory.push(metrics);
            this.trimMetricsHistory();
            if (this.config.dashboards.enabled && this.config.dashboards.realTimeUpdates) {
                // In production, would emit to dashboard subscribers
                console.log(`📊 Performance metrics collected: ${metrics.ensembleMetrics.averageResponseTime.toFixed(0)}ms avg response time`);
            }
        }, this.config.metricsCollection.interval);
    }
    /**
     * Checks for SLA violations in a request record
     */
    checkSLAViolations(record) {
        const thresholds = this.config.slaThresholds;
        // Response time violation
        if (record.duration > thresholds.maxEnsembleResponseTime) {
            this.createAlert({
                type: SLAViolationType.RESPONSE_TIME,
                severity: this.determineSeverity(record.duration, thresholds.maxEnsembleResponseTime),
                metric: 'ensemble_response_time',
                threshold: thresholds.maxEnsembleResponseTime,
                actualValue: record.duration,
                message: `Ensemble response time ${record.duration}ms exceeds threshold ${thresholds.maxEnsembleResponseTime}ms`,
                affectedRequests: 1
            });
        }
        // Cost violation
        if (record.cost > thresholds.maxCostPerRequest) {
            this.createAlert({
                type: SLAViolationType.COST,
                severity: ViolationSeverity.MEDIUM,
                metric: 'ensemble_cost',
                threshold: thresholds.maxCostPerRequest,
                actualValue: record.cost,
                message: `Request cost $${record.cost.toFixed(4)} exceeds threshold $${thresholds.maxCostPerRequest.toFixed(4)}`,
                affectedRequests: 1
            });
        }
        // Confidence violation
        if (record.confidence < thresholds.minConfidenceScore) {
            this.createAlert({
                type: SLAViolationType.CONFIDENCE,
                severity: ViolationSeverity.LOW,
                metric: 'ensemble_confidence',
                threshold: thresholds.minConfidenceScore,
                actualValue: record.confidence,
                message: `Confidence score ${record.confidence.toFixed(2)} below threshold ${thresholds.minConfidenceScore.toFixed(2)}`,
                affectedRequests: 1
            });
        }
        // Parallel efficiency violation
        const efficiencyLoss = 1 - record.parallelEfficiency;
        if (efficiencyLoss > thresholds.maxParallelEfficiencyLoss) {
            this.createAlert({
                type: SLAViolationType.PARALLEL_EFFICIENCY,
                severity: ViolationSeverity.MEDIUM,
                metric: 'parallel_efficiency',
                threshold: thresholds.maxParallelEfficiencyLoss,
                actualValue: efficiencyLoss,
                message: `Parallel efficiency loss ${(efficiencyLoss * 100).toFixed(1)}% exceeds threshold ${(thresholds.maxParallelEfficiencyLoss * 100).toFixed(1)}%`,
                affectedRequests: 1
            });
        }
    }
    /**
     * Creates a new alert if not in cooldown
     */
    createAlert(violation) {
        const alertKey = `${violation.type}_${violation.metric}`;
        const now = Date.now();
        const lastAlert = this.alertCooldowns.get(alertKey) || 0;
        if (now - lastAlert < this.config.alerting.alertCooldown) {
            return; // Still in cooldown
        }
        const alert = {
            id: `alert_${now}_${Math.random().toString(36).substr(2, 9)}`,
            type: violation.type,
            severity: violation.severity,
            message: violation.message,
            timestamp: new Date(),
            resolved: false
        };
        this.activeAlerts.set(alert.id, alert);
        this.alertCooldowns.set(alertKey, now);
        // Send alert notification
        this.sendAlertNotification(alert);
        console.warn(`🚨 Alert created: ${alert.message}`);
    }
    /**
     * Sends alert notification to configured channels
     */
    async sendAlertNotification(alert) {
        if (!this.config.alerting.enabled)
            return;
        // In production, would send to actual notification channels
        console.log(`🔔 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
        // Would implement actual webhook, email, Slack notifications here
        if (this.config.alerting.webhookUrl) {
            // await this.sendWebhookAlert(alert);
        }
        if (this.config.alerting.emailRecipients?.length) {
            // await this.sendEmailAlert(alert);
        }
        if (this.config.alerting.slackChannel) {
            // await this.sendSlackAlert(alert);
        }
    }
    /**
     * Calculates ensemble metrics from request records
     */
    calculateEnsembleMetrics(requests) {
        if (requests.length === 0) {
            return {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0,
                parallelEfficiency: 0,
                averageCost: 0,
                averageConfidence: 0,
                throughput: 0
            };
        }
        const successful = requests.filter(r => r.success);
        const durations = requests.map(r => r.duration).sort((a, b) => a - b);
        return {
            totalRequests: requests.length,
            successfulRequests: successful.length,
            failedRequests: requests.length - successful.length,
            averageResponseTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            p95ResponseTime: durations[Math.floor(durations.length * 0.95)] || 0,
            p99ResponseTime: durations[Math.floor(durations.length * 0.99)] || 0,
            parallelEfficiency: successful.reduce((sum, r) => sum + r.parallelEfficiency, 0) / Math.max(successful.length, 1),
            averageCost: requests.reduce((sum, r) => sum + r.cost, 0) / requests.length,
            averageConfidence: successful.reduce((sum, r) => sum + r.confidence, 0) / Math.max(successful.length, 1),
            throughput: this.calculateThroughput(requests)
        };
    }
    /**
     * Calculates provider-specific metrics
     */
    calculateProviderMetrics(requests) {
        const providerStats = new Map();
        for (const request of requests) {
            for (const response of request.individualResponses) {
                const provider = response.model;
                if (!providerStats.has(provider)) {
                    providerStats.set(provider, {
                        provider,
                        requests: 0,
                        successes: 0,
                        failures: 0,
                        averageResponseTime: 0,
                        p95ResponseTime: 0,
                        circuitBreakerTrips: 0,
                        rateLimitHits: 0,
                        totalCost: 0,
                        averageConfidence: 0,
                        availability: 1.0
                    });
                }
                const stats = providerStats.get(provider);
                const currentRequests = stats.requests;
                stats.requests = currentRequests + 1;
                stats.successes = stats.successes + 1;
                stats.averageResponseTime = (stats.averageResponseTime * currentRequests + response.responseTime) / stats.requests;
                stats.averageConfidence = (stats.averageConfidence * currentRequests + response.confidence) / stats.requests;
                stats.totalCost = stats.totalCost + (response.tokensUsed * 0.001); // Simplified cost calculation
            }
        }
        return providerStats;
    }
    /**
     * Calculates system metrics (simplified implementation)
     */
    calculateSystemMetrics() {
        // In production, would collect actual system metrics
        return {
            cpuUsage: Math.random() * 20 + 10, // 10-30%
            memoryUsage: Math.random() * 30 + 40, // 40-70%
            activeConnections: this.requestHistory.filter(r => Date.now() - r.timestamp.getTime() < 30000).length,
            queuedRequests: 0,
            errorRate: this.calculateErrorRate()
        };
    }
    /**
     * Calculates SLA compliance
     */
    calculateSLACompliance(requests) {
        if (requests.length === 0) {
            return {
                overallCompliance: 1.0,
                violations: [],
                complianceByMetric: {
                    responseTime: 1.0,
                    successRate: 1.0,
                    cost: 1.0,
                    confidence: 1.0,
                    parallelEfficiency: 1.0
                }
            };
        }
        const thresholds = this.config.slaThresholds;
        // Calculate compliance for each metric
        const responseTimeCompliance = requests.filter(r => r.duration <= thresholds.maxEnsembleResponseTime).length / requests.length;
        const successRateCompliance = requests.filter(r => r.success).length / requests.length;
        const costCompliance = requests.filter(r => r.cost <= thresholds.maxCostPerRequest).length / requests.length;
        const confidenceCompliance = requests.filter(r => r.confidence >= thresholds.minConfidenceScore).length / requests.length;
        const efficiencyCompliance = requests.filter(r => (1 - r.parallelEfficiency) <= thresholds.maxParallelEfficiencyLoss).length / requests.length;
        const complianceByMetric = {
            responseTime: responseTimeCompliance,
            successRate: successRateCompliance,
            cost: costCompliance,
            confidence: confidenceCompliance,
            parallelEfficiency: efficiencyCompliance
        };
        const overallCompliance = Object.values(complianceByMetric).reduce((sum, c) => sum + c, 0) / 5;
        return {
            overallCompliance,
            violations: Array.from(this.activeAlerts.values()).map(alert => ({
                type: alert.type,
                severity: alert.severity,
                metric: alert.type,
                threshold: 0, // Would be stored with alert
                actualValue: 0, // Would be stored with alert
                timestamp: alert.timestamp,
                duration: alert.resolved && alert.resolvedAt ?
                    alert.resolvedAt.getTime() - alert.timestamp.getTime() :
                    Date.now() - alert.timestamp.getTime(),
                affectedRequests: 1
            })),
            complianceByMetric
        };
    }
    /**
     * Helper methods
     */
    getRecentRequests(windowMs) {
        const cutoff = Date.now() - windowMs;
        return this.requestHistory.filter(r => r.timestamp.getTime() > cutoff);
    }
    trimRequestHistory() {
        const maxSize = 10000; // Keep last 10k requests
        if (this.requestHistory.length > maxSize) {
            this.requestHistory = this.requestHistory.slice(-maxSize);
        }
    }
    trimMetricsHistory() {
        const maxAge = this.config.metricsCollection.retentionPeriod;
        const cutoff = Date.now() - maxAge;
        this.metricsHistory = this.metricsHistory.filter(m => m.timestamp.getTime() > cutoff);
    }
    determineSeverity(actual, threshold) {
        const ratio = actual / threshold;
        if (ratio > 3)
            return ViolationSeverity.CRITICAL;
        if (ratio > 2)
            return ViolationSeverity.HIGH;
        if (ratio > 1.5)
            return ViolationSeverity.MEDIUM;
        return ViolationSeverity.LOW;
    }
    calculateThroughput(requests) {
        if (requests.length < 2)
            return 0;
        const timeSpan = requests[requests.length - 1].timestamp.getTime() - requests[0].timestamp.getTime();
        return timeSpan > 0 ? (requests.length * 1000) / timeSpan : 0;
    }
    calculateErrorRate() {
        const recentRequests = this.getRecentRequests(60000);
        if (recentRequests.length === 0)
            return 0;
        const errors = recentRequests.filter(r => !r.success).length;
        return errors / recentRequests.length;
    }
    calculateCostEfficiency(requests) {
        if (requests.length === 0)
            return 1.0;
        const avgCost = requests.reduce((sum, r) => sum + r.cost, 0) / requests.length;
        const avgConfidence = requests.reduce((sum, r) => sum + r.confidence, 0) / requests.length;
        // Cost efficiency = confidence per dollar spent
        return avgCost > 0 ? avgConfidence / avgCost : avgConfidence;
    }
    calculateResponseTimeDistribution(requests) {
        const durations = requests.map(r => r.duration);
        const bins = [0, 1000, 2000, 5000, 10000, 15000, Infinity];
        const distribution = new Array(bins.length - 1).fill(0);
        for (const duration of durations) {
            for (let i = 0; i < bins.length - 1; i++) {
                if (duration >= bins[i] && duration < bins[i + 1]) {
                    distribution[i]++;
                    break;
                }
            }
        }
        return distribution;
    }
    calculateErrorRateByProvider(requests) {
        const errorRates = {};
        const providerCounts = {};
        for (const request of requests) {
            for (const response of request.individualResponses) {
                const provider = response.model;
                if (!providerCounts[provider]) {
                    providerCounts[provider] = { total: 0, errors: 0 };
                }
                providerCounts[provider].total++;
            }
            // Count provider failures from failed requests
            if (!request.success && request.error) {
                // Simplified - in production would track which specific providers failed
                for (const response of request.individualResponses) {
                    const provider = response.model;
                    if (providerCounts[provider]) {
                        providerCounts[provider].errors++;
                    }
                }
            }
        }
        for (const [provider, counts] of Object.entries(providerCounts)) {
            errorRates[provider] = counts.total > 0 ? counts.errors / counts.total : 0;
        }
        return errorRates;
    }
    calculateTrends() {
        // Simplified trend calculation - in production would use proper time series analysis
        const recentMetrics = this.metricsHistory.slice(-100); // Last 100 data points
        return {
            responseTimeTrend: this.calculateTimeSeries(recentMetrics, m => m.ensembleMetrics.averageResponseTime),
            throughputTrend: this.calculateTimeSeries(recentMetrics, m => m.ensembleMetrics.throughput),
            errorRateTrend: this.calculateTimeSeries(recentMetrics, m => m.systemMetrics.errorRate),
            costTrend: this.calculateTimeSeries(recentMetrics, m => m.ensembleMetrics.averageCost),
            confidenceTrend: this.calculateTimeSeries(recentMetrics, m => m.ensembleMetrics.averageConfidence)
        };
    }
    calculateTimeSeries(metrics, valueExtractor) {
        const timestamps = metrics.map(m => m.timestamp);
        const values = metrics.map(valueExtractor);
        // Simple trend calculation
        let trend = 'stable';
        let changeRate = 0;
        if (values.length >= 2) {
            const firstHalf = values.slice(0, Math.floor(values.length / 2));
            const secondHalf = values.slice(Math.floor(values.length / 2));
            const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
            changeRate = (secondAvg - firstAvg) / Math.max(firstAvg, 0.001);
            if (Math.abs(changeRate) > 0.1) {
                trend = changeRate > 0 ? 'increasing' : 'decreasing';
            }
        }
        return {
            timestamps,
            values,
            trend,
            changeRate
        };
    }
    getAlertSummary() {
        const activeAlerts = Array.from(this.activeAlerts.values());
        const unresolved = activeAlerts.filter(a => !a.resolved);
        const critical = unresolved.filter(a => a.severity === ViolationSeverity.CRITICAL);
        return {
            activeAlerts: unresolved.length,
            criticalAlerts: critical.length,
            recentAlerts: activeAlerts.slice(-10),
            alertHistory: {
                totalAlerts: activeAlerts.length,
                alertsByType: this.groupAlertsByType(activeAlerts),
                alertsBySeverity: this.groupAlertsBySeverity(activeAlerts),
                meanTimeToResolution: this.calculateMTTR(activeAlerts)
            }
        };
    }
    getProviderComparison(metrics) {
        const providers = Array.from(metrics.providerMetrics.entries());
        return providers.map(([name, providerMetrics], index) => ({
            provider: name,
            rank: index + 1, // Simplified ranking
            score: (providerMetrics.availability + (1 - providerMetrics.averageResponseTime / 10000)) / 2,
            strengths: this.identifyProviderStrengths(providerMetrics),
            weaknesses: this.identifyProviderWeaknesses(providerMetrics),
            recommendations: this.generateProviderRecommendations(providerMetrics)
        }));
    }
    determineSystemStatus(metrics) {
        const compliance = metrics.slaCompliance.overallCompliance;
        const errorRate = metrics.systemMetrics.errorRate;
        if (compliance < 0.8 || errorRate > 0.1)
            return 'critical';
        if (compliance < 0.95 || errorRate > 0.05)
            return 'degraded';
        return 'healthy';
    }
    groupAlertsByType(alerts) {
        const groups = {
            [SLAViolationType.RESPONSE_TIME]: 0,
            [SLAViolationType.SUCCESS_RATE]: 0,
            [SLAViolationType.COST]: 0,
            [SLAViolationType.CONFIDENCE]: 0,
            [SLAViolationType.PARALLEL_EFFICIENCY]: 0
        };
        for (const alert of alerts) {
            groups[alert.type]++;
        }
        return groups;
    }
    groupAlertsBySeverity(alerts) {
        const groups = {
            [ViolationSeverity.CRITICAL]: 0,
            [ViolationSeverity.HIGH]: 0,
            [ViolationSeverity.MEDIUM]: 0,
            [ViolationSeverity.LOW]: 0
        };
        for (const alert of alerts) {
            groups[alert.severity]++;
        }
        return groups;
    }
    calculateMTTR(alerts) {
        const resolved = alerts.filter(a => a.resolved && a.resolvedAt);
        if (resolved.length === 0)
            return 0;
        const totalResolutionTime = resolved.reduce((sum, alert) => {
            return sum + (alert.resolvedAt.getTime() - alert.timestamp.getTime());
        }, 0);
        return totalResolutionTime / resolved.length;
    }
    identifyProviderStrengths(metrics) {
        const strengths = [];
        if (metrics.averageResponseTime < 2000)
            strengths.push('Fast response times');
        if (metrics.availability > 0.99)
            strengths.push('High availability');
        if (metrics.averageConfidence > 0.8)
            strengths.push('High confidence responses');
        if (metrics.circuitBreakerTrips === 0)
            strengths.push('Reliable service');
        return strengths;
    }
    identifyProviderWeaknesses(metrics) {
        const weaknesses = [];
        if (metrics.averageResponseTime > 5000)
            weaknesses.push('Slow response times');
        if (metrics.availability < 0.95)
            weaknesses.push('Availability issues');
        if (metrics.averageConfidence < 0.6)
            weaknesses.push('Low confidence responses');
        if (metrics.circuitBreakerTrips > 0)
            weaknesses.push('Reliability concerns');
        return weaknesses;
    }
    generateProviderRecommendations(metrics) {
        const recommendations = [];
        if (metrics.averageResponseTime > 3000) {
            recommendations.push('Consider timeout optimization');
        }
        if (metrics.rateLimitHits > 0) {
            recommendations.push('Review rate limiting configuration');
        }
        if (metrics.totalCost / metrics.requests > 0.01) {
            recommendations.push('Monitor cost efficiency');
        }
        return recommendations;
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
//# sourceMappingURL=performance.monitor.js.map