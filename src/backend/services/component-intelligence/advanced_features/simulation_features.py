import asyncio
import json
import logging
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from scipy import signal, optimize
import sqlite3
import pickle
import joblib
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

class SimulationType(Enum):
    """Control system simulation types"""
    STEADY_STATE = "steady_state"
    DYNAMIC = "dynamic"
    MONTE_CARLO = "monte_carlo"
    FAILURE_MODE = "failure_mode"
    PERFORMANCE = "performance"
    ENERGY_OPTIMIZATION = "energy_optimization"

class OptimizationObjective(Enum):
    """Optimization objectives"""
    ENERGY_EFFICIENCY = "energy_efficiency"
    PERFORMANCE = "performance"
    COST_MINIMIZATION = "cost_minimization"
    SAFETY_MAXIMIZATION = "safety_maximization"
    THROUGHPUT_MAXIMIZATION = "throughput_maximization"
    MAINTENANCE_OPTIMIZATION = "maintenance_optimization"

class PredictiveMaintenanceStrategy(Enum):
    """Predictive maintenance strategies"""
    CONDITION_BASED = "condition_based"
    TIME_BASED = "time_based"
    USAGE_BASED = "usage_based"
    PERFORMANCE_BASED = "performance_based"
    FAILURE_PREDICTION = "failure_prediction"
    DEGRADATION_MONITORING = "degradation_monitoring"

class AnalyticsModel(Enum):
    """Analytics model types"""
    LINEAR_REGRESSION = "linear_regression"
    RANDOM_FOREST = "random_forest"
    NEURAL_NETWORK = "neural_network"
    SVM = "svm"
    ISOLATION_FOREST = "isolation_forest"
    LSTM = "lstm"
    ARIMA = "arima"

@dataclass
class SimulationParameters:
    """Simulation configuration parameters"""
    simulation_type: SimulationType
    duration: float  # Simulation duration in seconds
    time_step: float  # Time step in seconds
    initial_conditions: Dict[str, float]
    process_parameters: Dict[str, float]
    disturbances: Dict[str, Any] = field(default_factory=dict)
    noise_level: float = 0.01
    monte_carlo_runs: int = 1000

@dataclass
class ControllerTuning:
    """PID controller tuning parameters"""
    kp: float  # Proportional gain
    ki: float  # Integral gain
    kd: float  # Derivative gain
    setpoint: float
    output_limits: Tuple[float, float] = (-100, 100)
    integral_limits: Tuple[float, float] = (-100, 100)

@dataclass
class ProcessModel:
    """Process transfer function model"""
    numerator: List[float]
    denominator: List[float]
    dead_time: float = 0.0
    process_gain: float = 1.0
    time_constant: float = 1.0
    damping_ratio: float = 1.0

@dataclass
class OptimizationResult:
    """Optimization analysis result"""
    objective: OptimizationObjective
    optimal_parameters: Dict[str, float]
    objective_value: float
    improvement_percentage: float
    convergence_iterations: int
    constraints_satisfied: bool
    recommendations: List[str] = field(default_factory=list)

@dataclass
class PredictiveMaintenanceAlert:
    """Predictive maintenance alert"""
    component_id: str
    alert_type: str
    severity: str  # Low, Medium, High, Critical
    predicted_failure_time: datetime
    confidence: float
    recommended_action: str
    cost_impact: float
    safety_impact: str

@dataclass
class PerformanceMetrics:
    """System performance metrics"""
    efficiency: float
    availability: float
    reliability: float
    energy_consumption: float
    throughput: float
    maintenance_cost: float
    safety_score: float
    environmental_impact: float

class ControlSystemSimulator:
    """Advanced control system simulation engine"""
    
    def __init__(self):
        self.models = {}
        self.controllers = {}
        self.simulation_results = {}
    
    async def run_simulation(self, 
                           parameters: SimulationParameters,
                           process_model: ProcessModel,
                           controller_tuning: ControllerTuning) -> Dict[str, Any]:
        """Run control system simulation"""
        
        if parameters.simulation_type == SimulationType.STEADY_STATE:
            return await self._run_steady_state_simulation(parameters, process_model, controller_tuning)
        elif parameters.simulation_type == SimulationType.DYNAMIC:
            return await self._run_dynamic_simulation(parameters, process_model, controller_tuning)
        elif parameters.simulation_type == SimulationType.MONTE_CARLO:
            return await self._run_monte_carlo_simulation(parameters, process_model, controller_tuning)
        elif parameters.simulation_type == SimulationType.FAILURE_MODE:
            return await self._run_failure_mode_simulation(parameters, process_model, controller_tuning)
        else:
            return await self._run_performance_simulation(parameters, process_model, controller_tuning)
    
    async def _run_steady_state_simulation(self, 
                                         parameters: SimulationParameters,
                                         process_model: ProcessModel,
                                         controller_tuning: ControllerTuning) -> Dict[str, Any]:
        """Run steady-state analysis"""
        
        # Create transfer function
        tf = signal.TransferFunction(process_model.numerator, process_model.denominator)
        
        # Calculate steady-state gain
        dc_gain = tf.dcgain
        
        # Calculate time domain characteristics
        settling_time = 4 * process_model.time_constant  # 2% settling time
        rise_time = 2.2 * process_model.time_constant  # 10-90% rise time
        
        # Calculate frequency response
        frequencies = np.logspace(-2, 2, 100)
        w, h = signal.freqresp(tf, frequencies)
        
        # Phase and gain margins
        gm, pm, wg, wp = signal.margin(tf)
        
        return {
            "steady_state_gain": float(dc_gain),
            "settling_time": settling_time,
            "rise_time": rise_time,
            "gain_margin": float(gm),
            "phase_margin": float(pm),
            "gain_crossover_freq": float(wg),
            "phase_crossover_freq": float(wp),
            "stability": "stable" if pm > 45 and gm > 6 else "marginal",
            "performance_assessment": self._assess_performance(pm, gm, settling_time)
        }
    
    async def _run_dynamic_simulation(self,
                                    parameters: SimulationParameters,
                                    process_model: ProcessModel,
                                    controller_tuning: ControllerTuning) -> Dict[str, Any]:
        """Run dynamic simulation with PID control"""
        
        # Time vector
        t = np.arange(0, parameters.duration, parameters.time_step)
        
        # Create process transfer function
        process_tf = signal.TransferFunction(process_model.numerator, process_model.denominator)
        
        # Create PID controller transfer function
        kp, ki, kd = controller_tuning.kp, controller_tuning.ki, controller_tuning.kd
        controller_num = [kd, kp, ki]
        controller_den = [1, 0]
        controller_tf = signal.TransferFunction(controller_num, controller_den)
        
        # Closed-loop system
        open_loop = signal.series(controller_tf, process_tf)
        closed_loop = signal.feedback(open_loop)
        
        # Step response
        t_step, y_step = signal.step(closed_loop, T=t)
        
        # Add noise and disturbances
        noise = np.random.normal(0, parameters.noise_level, len(y_step))
        y_noisy = y_step + noise
        
        # Calculate performance metrics
        overshoot = (np.max(y_step) - 1) * 100  # Percentage overshoot
        settling_time = self._calculate_settling_time(t_step, y_step)
        steady_state_error = abs(1 - y_step[-1])
        
        # Control effort (derivative of output as approximation)
        control_effort = np.gradient(y_step)
        
        return {
            "time": t_step.tolist(),
            "output": y_step.tolist(),
            "output_with_noise": y_noisy.tolist(),
            "control_effort": control_effort.tolist(),
            "overshoot_percent": float(overshoot),
            "settling_time": float(settling_time),
            "steady_state_error": float(steady_state_error),
            "performance_index": self._calculate_performance_index(t_step, y_step),
            "controller_parameters": {
                "kp": kp, "ki": ki, "kd": kd
            }
        }
    
    async def _run_monte_carlo_simulation(self,
                                        parameters: SimulationParameters,
                                        process_model: ProcessModel,
                                        controller_tuning: ControllerTuning) -> Dict[str, Any]:
        """Run Monte Carlo simulation for uncertainty analysis"""
        
        results = []
        
        for run in range(parameters.monte_carlo_runs):
            # Add parameter variations (±10% random variation)
            varied_gain = process_model.process_gain * (1 + np.random.uniform(-0.1, 0.1))
            varied_time_constant = process_model.time_constant * (1 + np.random.uniform(-0.1, 0.1))
            
            # Create varied process model
            varied_model = ProcessModel(
                numerator=[varied_gain],
                denominator=[varied_time_constant, 1],
                dead_time=process_model.dead_time,
                process_gain=varied_gain,
                time_constant=varied_time_constant
            )
            
            # Run single simulation
            single_result = await self._run_dynamic_simulation(parameters, varied_model, controller_tuning)
            results.append({
                "overshoot": single_result["overshoot_percent"],
                "settling_time": single_result["settling_time"],
                "steady_state_error": single_result["steady_state_error"]
            })
        
        # Statistical analysis
        overshoots = [r["overshoot"] for r in results]
        settling_times = [r["settling_time"] for r in results]
        sse_values = [r["steady_state_error"] for r in results]
        
        return {
            "monte_carlo_runs": parameters.monte_carlo_runs,
            "overshoot_statistics": {
                "mean": float(np.mean(overshoots)),
                "std": float(np.std(overshoots)),
                "min": float(np.min(overshoots)),
                "max": float(np.max(overshoots)),
                "percentile_95": float(np.percentile(overshoots, 95))
            },
            "settling_time_statistics": {
                "mean": float(np.mean(settling_times)),
                "std": float(np.std(settling_times)),
                "min": float(np.min(settling_times)),
                "max": float(np.max(settling_times)),
                "percentile_95": float(np.percentile(settling_times, 95))
            },
            "robust_performance": self._assess_robustness(overshoots, settling_times, sse_values)
        }
    
    async def _run_failure_mode_simulation(self,
                                         parameters: SimulationParameters,
                                         process_model: ProcessModel,
                                         controller_tuning: ControllerTuning) -> Dict[str, Any]:
        """Simulate failure modes and their effects"""
        
        failure_scenarios = [
            {"name": "Sensor Failure", "effect": "measurement_loss"},
            {"name": "Actuator Failure", "effect": "control_loss"},
            {"name": "Controller Failure", "effect": "logic_loss"},
            {"name": "Communication Failure", "effect": "signal_loss"},
            {"name": "Power Failure", "effect": "system_shutdown"}
        ]
        
        failure_results = {}
        
        for scenario in failure_scenarios:
            # Simulate failure effect
            if scenario["effect"] == "measurement_loss":
                # Sensor bias or complete failure
                failure_result = await self._simulate_sensor_failure(parameters, process_model, controller_tuning)
            elif scenario["effect"] == "control_loss":
                # Actuator stuck or limited
                failure_result = await self._simulate_actuator_failure(parameters, process_model, controller_tuning)
            else:
                # Generic failure simulation
                failure_result = await self._simulate_generic_failure(parameters, process_model, controller_tuning)
            
            failure_results[scenario["name"]] = failure_result
        
        return {
            "failure_scenarios": failure_results,
            "system_resilience": self._assess_system_resilience(failure_results),
            "recommended_safeguards": self._recommend_safeguards(failure_results)
        }
    
    async def _run_performance_simulation(self,
                                        parameters: SimulationParameters,
                                        process_model: ProcessModel,
                                        controller_tuning: ControllerTuning) -> Dict[str, Any]:
        """Run comprehensive performance analysis"""
        
        # Run multiple test scenarios
        scenarios = {
            "setpoint_tracking": await self._test_setpoint_tracking(parameters, process_model, controller_tuning),
            "disturbance_rejection": await self._test_disturbance_rejection(parameters, process_model, controller_tuning),
            "load_changes": await self._test_load_changes(parameters, process_model, controller_tuning),
            "measurement_noise": await self._test_noise_rejection(parameters, process_model, controller_tuning)
        }
        
        # Overall performance score
        performance_score = self._calculate_overall_performance(scenarios)
        
        return {
            "performance_scenarios": scenarios,
            "overall_performance_score": performance_score,
            "performance_grade": self._grade_performance(performance_score),
            "improvement_recommendations": self._generate_improvement_recommendations(scenarios)
        }
    
    def _calculate_settling_time(self, t: np.ndarray, y: np.ndarray, tolerance: float = 0.02) -> float:
        """Calculate 2% settling time"""
        final_value = y[-1]
        tolerance_band = tolerance * abs(final_value)
        
        # Find last time output leaves tolerance band
        for i in range(len(y)-1, -1, -1):
            if abs(y[i] - final_value) > tolerance_band:
                return t[i] if i < len(t)-1 else t[-1]
        
        return 0.0
    
    def _calculate_performance_index(self, t: np.ndarray, y: np.ndarray) -> float:
        """Calculate Integral of Time-weighted Absolute Error (ITAE)"""
        error = abs(1 - y)  # Assuming unit step reference
        itae = np.trapz(t * error, t)
        return float(itae)
    
    def _assess_performance(self, phase_margin: float, gain_margin: float, settling_time: float) -> str:
        """Assess overall system performance"""
        if phase_margin > 60 and gain_margin > 10 and settling_time < 5:
            return "Excellent"
        elif phase_margin > 45 and gain_margin > 6 and settling_time < 10:
            return "Good"
        elif phase_margin > 30 and gain_margin > 3 and settling_time < 20:
            return "Acceptable"
        else:
            return "Poor"

class ControlSystemOptimizer:
    """Advanced control system optimization"""
    
    def __init__(self):
        self.optimization_history = []
        self.best_parameters = {}
    
    async def optimize_controller(self,
                                process_model: ProcessModel,
                                objective: OptimizationObjective,
                                constraints: Dict[str, Any] = None) -> OptimizationResult:
        """Optimize controller parameters"""
        
        if objective == OptimizationObjective.PERFORMANCE:
            return await self._optimize_performance(process_model, constraints)
        elif objective == OptimizationObjective.ENERGY_EFFICIENCY:
            return await self._optimize_energy_efficiency(process_model, constraints)
        else:
            return await self._optimize_multi_objective(process_model, objective, constraints)
    
    async def _optimize_performance(self,
                                  process_model: ProcessModel,
                                  constraints: Dict[str, Any]) -> OptimizationResult:
        """Optimize for control performance"""
        
        def objective_function(params):
            kp, ki, kd = params
            
            # Create controller
            controller_tuning = ControllerTuning(kp=kp, ki=ki, kd=kd, setpoint=1.0)
            
            # Simulate system
            simulator = ControlSystemSimulator()
            sim_params = SimulationParameters(
                simulation_type=SimulationType.DYNAMIC,
                duration=20.0,
                time_step=0.1,
                initial_conditions={},
                process_parameters={}
            )
            
            # Run simulation (synchronous version for optimization)
            result = self._simulate_for_optimization(sim_params, process_model, controller_tuning)
            
            # Multi-objective: minimize overshoot, settling time, and steady-state error
            overshoot_penalty = max(0, result["overshoot_percent"] - 5) * 10  # Penalize >5% overshoot
            settling_time_penalty = result["settling_time"] * 5
            sse_penalty = result["steady_state_error"] * 1000
            
            return overshoot_penalty + settling_time_penalty + sse_penalty
        
        # Parameter bounds: [kp_min, ki_min, kd_min], [kp_max, ki_max, kd_max]
        bounds = [(0.1, 10), (0.01, 5), (0.001, 2)]
        
        # Initial guess
        x0 = [1.0, 0.1, 0.01]
        
        # Optimize using scipy
        result = optimize.minimize(objective_function, x0, bounds=bounds, method='L-BFGS-B')
        
        optimal_kp, optimal_ki, optimal_kd = result.x
        
        # Calculate improvement
        baseline_performance = objective_function([1.0, 0.1, 0.01])  # Baseline PID
        optimized_performance = result.fun
        improvement = ((baseline_performance - optimized_performance) / baseline_performance) * 100
        
        return OptimizationResult(
            objective=OptimizationObjective.PERFORMANCE,
            optimal_parameters={
                "kp": float(optimal_kp),
                "ki": float(optimal_ki),
                "kd": float(optimal_kd)
            },
            objective_value=float(optimized_performance),
            improvement_percentage=float(improvement),
            convergence_iterations=result.nit,
            constraints_satisfied=result.success,
            recommendations=[
                f"Optimal Kp: {optimal_kp:.3f}",
                f"Optimal Ki: {optimal_ki:.3f}",
                f"Optimal Kd: {optimal_kd:.3f}",
                f"Performance improvement: {improvement:.1f}%"
            ]
        )
    
    async def _optimize_energy_efficiency(self,
                                        process_model: ProcessModel,
                                        constraints: Dict[str, Any]) -> OptimizationResult:
        """Optimize for energy efficiency"""
        
        def energy_objective(params):
            kp, ki, kd = params
            
            # Energy consumption is proportional to control effort
            # Simulate and calculate total control effort
            controller_tuning = ControllerTuning(kp=kp, ki=ki, kd=kd, setpoint=1.0)
            
            sim_params = SimulationParameters(
                simulation_type=SimulationType.DYNAMIC,
                duration=20.0,
                time_step=0.1,
                initial_conditions={},
                process_parameters={}
            )
            
            result = self._simulate_for_optimization(sim_params, process_model, controller_tuning)
            
            # Energy penalty based on control effort and settling time
            control_effort = np.array(result["control_effort"])
            total_energy = np.sum(np.abs(control_effort))
            
            # Also penalize poor performance
            performance_penalty = result["overshoot_percent"] + result["settling_time"] * 2
            
            return total_energy + performance_penalty
        
        bounds = [(0.1, 5), (0.01, 2), (0.001, 1)]
        x0 = [0.5, 0.05, 0.005]  # Conservative starting point for energy efficiency
        
        result = optimize.minimize(energy_objective, x0, bounds=bounds, method='L-BFGS-B')
        
        optimal_kp, optimal_ki, optimal_kd = result.x
        
        # Calculate energy savings
        baseline_energy = energy_objective([1.0, 0.1, 0.01])
        optimized_energy = result.fun
        energy_savings = ((baseline_energy - optimized_energy) / baseline_energy) * 100
        
        return OptimizationResult(
            objective=OptimizationObjective.ENERGY_EFFICIENCY,
            optimal_parameters={
                "kp": float(optimal_kp),
                "ki": float(optimal_ki),
                "kd": float(optimal_kd)
            },
            objective_value=float(optimized_energy),
            improvement_percentage=float(energy_savings),
            convergence_iterations=result.nit,
            constraints_satisfied=result.success,
            recommendations=[
                f"Energy-optimized Kp: {optimal_kp:.3f}",
                f"Energy-optimized Ki: {optimal_ki:.3f}",
                f"Energy-optimized Kd: {optimal_kd:.3f}",
                f"Energy savings: {energy_savings:.1f}%"
            ]
        )
    
    def _simulate_for_optimization(self,
                                 parameters: SimulationParameters,
                                 process_model: ProcessModel,
                                 controller_tuning: ControllerTuning) -> Dict[str, Any]:
        """Synchronous simulation for optimization (simplified)"""
        
        # Simplified simulation for optimization speed
        t = np.arange(0, parameters.duration, parameters.time_step)
        
        # Simple first-order system approximation
        tau = process_model.time_constant
        K = process_model.process_gain
        
        # PID controller simulation
        kp, ki, kd = controller_tuning.kp, controller_tuning.ki, controller_tuning.kd
        
        # Closed-loop response approximation
        wn = np.sqrt(kp * K / tau)  # Natural frequency
        zeta = (kp * K + kd) / (2 * np.sqrt(kp * K * tau))  # Damping ratio
        
        # Step response characteristics
        if zeta < 1:  # Underdamped
            wd = wn * np.sqrt(1 - zeta**2)
            overshoot = np.exp(-zeta * np.pi / np.sqrt(1 - zeta**2)) * 100
            settling_time = 4 / (zeta * wn)
        else:  # Overdamped or critically damped
            overshoot = 0
            settling_time = 4 / wn
        
        # Approximate control effort
        control_effort = np.ones_like(t) * kp  # Simplified
        
        steady_state_error = 1 / (1 + kp * K)  # Steady-state error for step input
        
        return {
            "overshoot_percent": float(overshoot),
            "settling_time": float(settling_time),
            "steady_state_error": float(abs(steady_state_error)),
            "control_effort": control_effort.tolist()
        }

class PredictiveMaintenanceEngine:
    """Advanced predictive maintenance using machine learning"""
    
    def __init__(self, model_path: Optional[Path] = None):
        self.models = {}
        self.feature_extractors = {}
        self.alert_thresholds = {}
        self.maintenance_history = []
        
        if model_path and model_path.exists():
            self._load_models(model_path)
        else:
            self._initialize_default_models()
    
    async def analyze_component_health(self,
                                     component_id: str,
                                     sensor_data: Dict[str, np.ndarray],
                                     component_type: str) -> Dict[str, Any]:
        """Analyze component health and predict maintenance needs"""
        
        # Extract features from sensor data
        features = self._extract_features(sensor_data, component_type)
        
        # Predict health score
        health_score = self._predict_health_score(features, component_type)
        
        # Predict remaining useful life
        rul = self._predict_remaining_useful_life(features, component_type)
        
        # Detect anomalies
        anomalies = self._detect_anomalies(features, component_type)
        
        # Generate maintenance alerts
        alerts = self._generate_maintenance_alerts(component_id, health_score, rul, anomalies)
        
        # Calculate maintenance recommendations
        recommendations = self._generate_maintenance_recommendations(health_score, rul, component_type)
        
        return {
            "component_id": component_id,
            "health_score": float(health_score),
            "remaining_useful_life_days": float(rul),
            "anomalies_detected": anomalies,
            "maintenance_alerts": alerts,
            "recommendations": recommendations,
            "confidence": self._calculate_prediction_confidence(features, component_type),
            "next_inspection_date": self._calculate_next_inspection(rul),
            "cost_impact": self._estimate_cost_impact(health_score, rul)
        }
    
    def _extract_features(self, sensor_data: Dict[str, np.ndarray], component_type: str) -> np.ndarray:
        """Extract relevant features from sensor data"""
        
        features = []
        
        for sensor_name, data in sensor_data.items():
            if len(data) == 0:
                continue
            
            # Statistical features
            features.extend([
                np.mean(data),
                np.std(data),
                np.min(data),
                np.max(data),
                np.percentile(data, 25),
                np.percentile(data, 75),
                len(data)
            ])
            
            # Frequency domain features (if applicable)
            if len(data) > 10:
                fft = np.fft.fft(data)
                features.extend([
                    np.mean(np.abs(fft)),
                    np.std(np.abs(fft)),
                    np.argmax(np.abs(fft))  # Dominant frequency
                ])
            
            # Trend features
            if len(data) > 5:
                # Linear trend
                x = np.arange(len(data))
                slope, intercept = np.polyfit(x, data, 1)
                features.extend([slope, intercept])
        
        # Component-specific features
        if component_type == "motor":
            features.extend(self._extract_motor_features(sensor_data))
        elif component_type == "pump":
            features.extend(self._extract_pump_features(sensor_data))
        elif component_type == "valve":
            features.extend(self._extract_valve_features(sensor_data))
        
        return np.array(features)
    
    def _extract_motor_features(self, sensor_data: Dict[str, np.ndarray]) -> List[float]:
        """Extract motor-specific features"""
        features = []
        
        # Vibration analysis
        if "vibration" in sensor_data:
            vib_data = sensor_data["vibration"]
            if len(vib_data) > 0:
                # RMS vibration
                rms_vib = np.sqrt(np.mean(vib_data**2))
                features.append(rms_vib)
                
                # Peak factor
                peak_factor = np.max(np.abs(vib_data)) / rms_vib if rms_vib > 0 else 0
                features.append(peak_factor)
        
        # Current signature analysis
        if "current" in sensor_data:
            current_data = sensor_data["current"]
            if len(current_data) > 0:
                # Current imbalance
                current_imbalance = np.std(current_data) / np.mean(current_data) if np.mean(current_data) > 0 else 0
                features.append(current_imbalance)
        
        # Temperature analysis
        if "temperature" in sensor_data:
            temp_data = sensor_data["temperature"]
            if len(temp_data) > 0:
                # Temperature rise rate
                if len(temp_data) > 1:
                    temp_rise_rate = (temp_data[-1] - temp_data[0]) / len(temp_data)
                    features.append(temp_rise_rate)
        
        return features
    
    def _extract_pump_features(self, sensor_data: Dict[str, np.ndarray]) -> List[float]:
        """Extract pump-specific features"""
        features = []
        
        # Flow and pressure relationship
        if "flow" in sensor_data and "pressure" in sensor_data:
            flow_data = sensor_data["flow"]
            pressure_data = sensor_data["pressure"]
            
            if len(flow_data) > 0 and len(pressure_data) > 0:
                # Pump efficiency indicator
                min_len = min(len(flow_data), len(pressure_data))
                flow_pressure_ratio = np.mean(flow_data[:min_len] * pressure_data[:min_len])
                features.append(flow_pressure_ratio)
        
        # Cavitation detection
        if "vibration" in sensor_data and "pressure" in sensor_data:
            # High frequency vibration correlated with low pressure indicates cavitation
            if len(sensor_data["vibration"]) > 10 and len(sensor_data["pressure"]) > 10:
                vib_hf = np.mean(np.abs(np.fft.fft(sensor_data["vibration"])[5:]))  # High frequency content
                avg_pressure = np.mean(sensor_data["pressure"])
                cavitation_indicator = vib_hf / avg_pressure if avg_pressure > 0 else 0
                features.append(cavitation_indicator)
        
        return features
    
    def _extract_valve_features(self, sensor_data: Dict[str, np.ndarray]) -> List[float]:
        """Extract valve-specific features"""
        features = []
        
        # Valve stroke analysis
        if "position" in sensor_data:
            position_data = sensor_data["position"]
            if len(position_data) > 1:
                # Position deviation from setpoint
                if "setpoint" in sensor_data:
                    setpoint_data = sensor_data["setpoint"]
                    min_len = min(len(position_data), len(setpoint_data))
                    position_error = np.mean(np.abs(position_data[:min_len] - setpoint_data[:min_len]))
                    features.append(position_error)
                
                # Stroke smoothness
                position_velocity = np.gradient(position_data)
                stroke_smoothness = np.std(position_velocity)
                features.append(stroke_smoothness)
        
        # Valve signature analysis
        if "pressure_upstream" in sensor_data and "pressure_downstream" in sensor_data:
            p_up = sensor_data["pressure_upstream"]
            p_down = sensor_data["pressure_downstream"]
            
            if len(p_up) > 0 and len(p_down) > 0:
                min_len = min(len(p_up), len(p_down))
                pressure_drop = np.mean(p_up[:min_len] - p_down[:min_len])
                features.append(pressure_drop)
        
        return features
    
    def _predict_health_score(self, features: np.ndarray, component_type: str) -> float:
        """Predict component health score (0-100)"""
        
        if component_type in self.models and "health" in self.models[component_type]:
            model = self.models[component_type]["health"]
            try:
                # Ensure features have the right shape
                if len(features) > 0:
                    features_reshaped = features.reshape(1, -1)
                    health_score = model.predict(features_reshaped)[0]
                    return max(0, min(100, health_score))
            except Exception as e:
                logger.warning(f"Health prediction failed: {e}")
        
        # Fallback: simple heuristic based on feature statistics
        if len(features) > 0:
            # Normalize features and calculate health based on deviations
            feature_std = np.std(features)
            feature_mean = np.mean(features)
            
            # Simple health score: lower variation and moderate values indicate better health
            health_score = 100 - (feature_std * 10) - (abs(feature_mean) * 5)
            return max(20, min(100, health_score))  # Clamp between 20-100
        
        return 75.0  # Default moderate health
    
    def _predict_remaining_useful_life(self, features: np.ndarray, component_type: str) -> float:
        """Predict remaining useful life in days"""
        
        if component_type in self.models and "rul" in self.models[component_type]:
            model = self.models[component_type]["rul"]
            try:
                if len(features) > 0:
                    features_reshaped = features.reshape(1, -1)
                    rul_days = model.predict(features_reshaped)[0]
                    return max(0, rul_days)
            except Exception as e:
                logger.warning(f"RUL prediction failed: {e}")
        
        # Fallback: estimate based on health score
        health_score = self._predict_health_score(features, component_type)
        
        # Typical component lifespans (days)
        typical_lifespans = {
            "motor": 3650,  # 10 years
            "pump": 2920,   # 8 years
            "valve": 2190,  # 6 years
            "sensor": 1825, # 5 years
            "default": 2555 # 7 years
        }
        
        typical_lifespan = typical_lifespans.get(component_type, typical_lifespans["default"])
        
        # RUL proportional to health score
        rul = (health_score / 100) * typical_lifespan
        return max(30, rul)  # Minimum 30 days
    
    def _detect_anomalies(self, features: np.ndarray, component_type: str) -> List[Dict[str, Any]]:
        """Detect anomalies in component behavior"""
        
        anomalies = []
        
        if component_type in self.models and "anomaly" in self.models[component_type]:
            model = self.models[component_type]["anomaly"]
            try:
                if len(features) > 0:
                    features_reshaped = features.reshape(1, -1)
                    anomaly_score = model.decision_function(features_reshaped)[0]
                    is_anomaly = model.predict(features_reshaped)[0] == -1
                    
                    if is_anomaly:
                        anomalies.append({
                            "type": "Statistical Anomaly",
                            "severity": "Medium" if anomaly_score < -0.5 else "Low",
                            "score": float(anomaly_score),
                            "description": "Detected unusual pattern in sensor data"
                        })
            except Exception as e:
                logger.warning(f"Anomaly detection failed: {e}")
        
        # Rule-based anomaly detection
        if len(features) > 0:
            # Check for extreme values
            z_scores = np.abs((features - np.mean(features)) / (np.std(features) + 1e-6))
            extreme_indices = np.where(z_scores > 3)[0]
            
            if len(extreme_indices) > 0:
                anomalies.append({
                    "type": "Extreme Values",
                    "severity": "High" if np.max(z_scores) > 5 else "Medium",
                    "score": float(np.max(z_scores)),
                    "description": f"Detected {len(extreme_indices)} extreme sensor readings"
                })
        
        return anomalies
    
    def _generate_maintenance_alerts(self,
                                   component_id: str,
                                   health_score: float,
                                   rul: float,
                                   anomalies: List[Dict[str, Any]]) -> List[PredictiveMaintenanceAlert]:
        """Generate maintenance alerts based on analysis"""
        
        alerts = []
        
        # Health-based alerts
        if health_score < 30:
            alerts.append(PredictiveMaintenanceAlert(
                component_id=component_id,
                alert_type="Critical Health",
                severity="Critical",
                predicted_failure_time=datetime.now() + timedelta(days=min(rul, 7)),
                confidence=0.9,
                recommended_action="Immediate inspection and maintenance required",
                cost_impact=10000.0,
                safety_impact="High"
            ))
        elif health_score < 50:
            alerts.append(PredictiveMaintenanceAlert(
                component_id=component_id,
                alert_type="Poor Health",
                severity="High",
                predicted_failure_time=datetime.now() + timedelta(days=rul),
                confidence=0.8,
                recommended_action="Schedule maintenance within 2 weeks",
                cost_impact=5000.0,
                safety_impact="Medium"
            ))
        elif health_score < 70:
            alerts.append(PredictiveMaintenanceAlert(
                component_id=component_id,
                alert_type="Declining Health",
                severity="Medium",
                predicted_failure_time=datetime.now() + timedelta(days=rul),
                confidence=0.7,
                recommended_action="Plan maintenance within next month",
                cost_impact=2000.0,
                safety_impact="Low"
            ))
        
        # RUL-based alerts
        if rul < 30:
            alerts.append(PredictiveMaintenanceAlert(
                component_id=component_id,
                alert_type="Short RUL",
                severity="High",
                predicted_failure_time=datetime.now() + timedelta(days=rul),
                confidence=0.8,
                recommended_action="Prepare for component replacement",
                cost_impact=8000.0,
                safety_impact="Medium"
            ))
        
        # Anomaly-based alerts
        for anomaly in anomalies:
            if anomaly["severity"] in ["High", "Critical"]:
                alerts.append(PredictiveMaintenanceAlert(
                    component_id=component_id,
                    alert_type=f"Anomaly: {anomaly['type']}",
                    severity=anomaly["severity"],
                    predicted_failure_time=datetime.now() + timedelta(days=14),
                    confidence=0.6,
                    recommended_action="Investigate anomalous behavior",
                    cost_impact=3000.0,
                    safety_impact="Medium"
                ))
        
        return alerts
    
    def _initialize_default_models(self):
        """Initialize default machine learning models"""
        # This would typically load pre-trained models
        # For now, we'll create placeholder models
        
        try:
            from sklearn.ensemble import RandomForestRegressor, IsolationForest
            from sklearn.linear_model import LinearRegression
            
            component_types = ["motor", "pump", "valve", "sensor"]
            
            for comp_type in component_types:
                self.models[comp_type] = {
                    "health": RandomForestRegressor(n_estimators=50, random_state=42),
                    "rul": LinearRegression(),
                    "anomaly": IsolationForest(contamination=0.1, random_state=42)
                }
                
                # Train with dummy data for demonstration
                dummy_features = np.random.rand(100, 20)
                dummy_health = np.random.rand(100) * 100
                dummy_rul = np.random.rand(100) * 1000
                
                self.models[comp_type]["health"].fit(dummy_features, dummy_health)
                self.models[comp_type]["rul"].fit(dummy_features, dummy_rul)
                self.models[comp_type]["anomaly"].fit(dummy_features)
                
        except ImportError:
            logger.warning("Scikit-learn not available, using fallback models")
            # Create empty models dict for fallback behavior
            self.models = {}

# Testing functions
async def test_advanced_control_features():
    """Test advanced control system features"""
    
    print("Testing Control System Simulation:")
    
    # Create process model (first-order lag)
    process_model = ProcessModel(
        numerator=[1.0],
        denominator=[10.0, 1.0],
        process_gain=2.0,
        time_constant=10.0
    )
    
    # Controller tuning
    controller_tuning = ControllerTuning(
        kp=0.5,
        ki=0.1,
        kd=0.05,
        setpoint=1.0
    )
    
    # Simulation parameters
    sim_params = SimulationParameters(
        simulation_type=SimulationType.DYNAMIC,
        duration=50.0,
        time_step=0.1,
        initial_conditions={},
        process_parameters={}
    )
    
    # Run simulation
    simulator = ControlSystemSimulator()
    result = await simulator.run_simulation(sim_params, process_model, controller_tuning)
    
    print(f"Simulation Results:")
    print(f"Overshoot: {result['overshoot_percent']:.2f}%")
    print(f"Settling Time: {result['settling_time']:.2f} seconds")
    print(f"Steady-State Error: {result['steady_state_error']:.4f}")
    
    # Test optimization
    print("\nTesting Controller Optimization:")
    optimizer = ControlSystemOptimizer()
    opt_result = await optimizer.optimize_controller(
        process_model, 
        OptimizationObjective.PERFORMANCE
    )
    
    print(f"Optimization Results:")
    print(f"Optimal Kp: {opt_result.optimal_parameters['kp']:.3f}")
    print(f"Optimal Ki: {opt_result.optimal_parameters['ki']:.3f}")
    print(f"Optimal Kd: {opt_result.optimal_parameters['kd']:.3f}")
    print(f"Performance Improvement: {opt_result.improvement_percentage:.1f}%")
    
    # Test predictive maintenance
    print("\nTesting Predictive Maintenance:")
    pm_engine = PredictiveMaintenanceEngine()
    
    # Generate sample sensor data
    sample_sensor_data = {
        "vibration": np.random.normal(0.5, 0.1, 100),
        "temperature": np.random.normal(60, 5, 100),
        "current": np.random.normal(10, 1, 100)
    }
    
    health_analysis = await pm_engine.analyze_component_health(
        "MOTOR-001", sample_sensor_data, "motor"
    )
    
    print(f"Health Analysis Results:")
    print(f"Health Score: {health_analysis['health_score']:.1f}/100")
    print(f"Remaining Useful Life: {health_analysis['remaining_useful_life_days']:.0f} days")
    print(f"Anomalies Detected: {len(health_analysis['anomalies_detected'])}")
    print(f"Maintenance Alerts: {len(health_analysis['maintenance_alerts'])}")

if __name__ == "__main__":
    asyncio.run(test_advanced_control_features())