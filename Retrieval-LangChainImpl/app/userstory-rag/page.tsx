"use client";

import React, { useEffect, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import { RAGPipelineResponse } from '@/app/types';
import AnimatedRadialScore from './AnimatedRadialScore';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,  Tooltip, LineChart, Line
} from "recharts";
import { motion } from "framer-motion";

// Accessible SVG radial score component
export const RadialScore: React.FC<{ score: number | undefined, size?: number }> = ({ score = 0, size = 140 }) => {
    const normalized = Math.max(0, Math.min(100, Math.round(score || 0)));
    const stroke = 12;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const dash = (normalized / 100) * circumference;

    return (
        <svg
            role="img"
            aria-label={`Story quality ${normalized} percent`}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="mx-auto"
        >
            <defs>
                <linearGradient id="gradGood" x1="0%" x2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#84cc16" />
                </linearGradient>
                <linearGradient id="gradWarn" x1="0%" x2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <linearGradient id="gradBad" x1="0%" x2="100%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
            </defs>

            <g transform={`translate(${size / 2}, ${size / 2})`}>
                <circle
                    r={radius}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth={stroke}
                    className="opacity-80"
                />

                <circle
                    r={radius}
                    fill="none"
                    stroke={normalized >= 70 ? 'url(#gradGood)' : normalized >= 40 ? 'url(#gradWarn)' : 'url(#gradBad)'}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-circumference * 0.25}
                    transform={`rotate(-90)`}
                />

                <foreignObject x={-radius} y={-radius} width={size} height={size}>
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <div className="text-2xl font-bold">{normalized}%</div>
                        <div className="text-xs text-gray-500">{normalized >= 90 ? 'A+' : normalized >= 80 ? 'A' : normalized >= 70 ? 'B+' : normalized >= 60 ? 'B' : normalized >= 50 ? 'C' : 'D'}</div>
                    </div>
                </foreignObject>
            </g>
        </svg>
    );
};


const steps = ['Normalize', 'LLM Refinement', 'Quality Assessment', 'Relevant Stories'];

export default function UserStoryRAG() {
    const [story, setStory] = useState('');
    const [vectorWeight, setVectorWeight] = useState(0.6);
    const [bm25Weight, setBm25Weight] = useState(0.3);
    const [hybridWeight, setHybridWeight] = useState(0.1);
    const [topK, setTopK] = useState(6);

    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState(0);
    const [result, setResult] = useState<RAGPipelineResponse | null>(null);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current);
        };
    }, []);

    const startProgress = () => {
        setProgress(5);
        setCurrentStep(0);
        timerRef.current = window.setInterval(() => {
            setProgress((p) => Math.min(95, p + 15));
            setCurrentStep((s) => Math.min(steps.length - 1, s + 1));
        }, 700) as unknown as number;
    };

    const stopProgress = () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setProgress(100);
        setTimeout(() => setProgress(0), 1200);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);
        startProgress();

        try {
            const response = await fetch('/api/rag-pipeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    story,
                    config: { vectorWeight, bm25Weight, hybridWeight, topK }
                })
            });

            const data = await response.json();
            setResult(data);
            console.log('RAG result', data);
        } catch (err) {
            console.error(err);
        } finally {
            stopProgress();
            setLoading(false);
        }
    };

    const gradeFromScore = (scorePercent: number) => {
        if (scorePercent >= 90) return 'A+';
        if (scorePercent >= 80) return 'A';
        if (scorePercent >= 70) return 'B+';
        if (scorePercent >= 60) return 'B';
        if (scorePercent >= 50) return 'C';
        return 'D';
    };

    return (
        <Layout>
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">User Story RAG Pipeline Search</h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Enter User Story</label>
                        <textarea
                            value={story}
                            onChange={(e) => setStory(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            rows={4}
                            placeholder="As a [role], I want [action] so that [value]..."
                        />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm">Vector Weight: {vectorWeight}</label>
                            <input type="range" min={0} max={1} step={0.05} value={vectorWeight} onChange={(e) => setVectorWeight(parseFloat(e.target.value))} className="w-full" />
                        </div>
                        <div>
                            <label className="block text-sm">BM25 Weight: {bm25Weight}</label>
                            <input type="range" min={0} max={1} step={0.05} value={bm25Weight} onChange={(e) => setBm25Weight(parseFloat(e.target.value))} className="w-full" />
                        </div>
                        <div>
                            <label className="block text-sm">Hybrid (LLM) Weight: {hybridWeight}</label>
                            <input type="range" min={0} max={1} step={0.05} value={hybridWeight} onChange={(e) => setHybridWeight(parseFloat(e.target.value))} className="w-full" />
                        </div>
                        <div>
                            <label className="block text-sm">Top K</label>
                            <input type="number" min={1} max={20} value={topK} onChange={(e) => setTopK(parseInt(e.target.value || '6'))} className="w-full rounded border-gray-300" />
                        </div>
                    </div>
                    <div className="flex flex-col items-start space-y-1">
                    <button
                        type="submit"
                        disabled={loading}
                        className={`relative inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium shadow-md transition-all duration-300
                        ${loading
                            ? "bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white opacity-100"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"}
                        `}
                    >
                        {loading ? (
                        <>
                            <span className="flex items-center gap-2">
                            <svg
                                className="h-4 w-4 animate-spin text-indigo-200"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                ></circle>
                                <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                ></path>
                            </svg>
                            Running Complete Analysis...${steps[currentStep]}
                            </span>
                        </>
                        ) : (
                        "Search Similar Stories"
                        )}
                    </button>

                    {/* Steps shown outside the button for clarity and non-faded color */}
                    {loading && (
                        <p className="text-xs text-indigo-400 italic mt-1">
                        Steps: Normalize → LLM Refinement → Quality Assessment → Relevant Stories
                        </p>
                    )}
                    </div>

                    
                </form>

                {/* Progress bar and stepper */}
                {loading && (
                    <div className="mt-6">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div className="bg-indigo-600 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                            {/* {steps.map((s, i) => (
                                 <div key={s} className={`px-1 ${i === currentStep ? 'text-indigo-700 font-semibold' : ''}`}>{s}</div>
                            ))} */}
                        </div>
                    </div>
                )}

                {result && (
                    <div className="mt-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-semibold mb-2">Normalized Story</h2>
                            <p className="bg-gray-50 p-4 rounded">{result.normalized_new_story}</p>
                        </div>

                        {result.refined_story && (
                            <div>
                                <h2 className="text-xl font-semibold mb-2">Refined Story</h2>
                                <p className="bg-gray-50 p-4 rounded whitespace-pre-wrap">{result.refined_story}</p>
                            </div>
                        )}
                    <div className="grid grid-cols-3 gap-6 items-start bg-gradient-to-br from-pink-100 via-indigo-50 to-purple-100 p-6 rounded-2xl shadow-lg">
  {/* Radial score + radar chart */}
  <div className="flex flex-col items-center justify-center col-span-1 space-y-4">
    <h4 className="text-lg font-medium">Story Quality</h4>
    <AnimatedRadialScore score={result.story_quality_score} size={160} />

  </div>

  {/* Breakdown bars */}
  <div className="flex flex-col items-center justify-center col-span-2 space-y-6">
    <h4 className="text-lg font-medium">Characteristic Breakdown</h4>
    <ResponsiveContainer width="100%" height={170}>
        
      <RadarChart
        cx="50%"
        cy="50%"
        outerRadius="70%"
        data={Object.entries(result.quality_breakdown || {}).map(([key, val]) => ({
          metric: key +"    -    " +( Number(val))+"/10",
          score: Number(val) || 0,
        }))}
      >
        <PolarGrid stroke="#01070fff" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: "#f8f8f8ff" }} />
        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} />
        <Radar
          name="Quality"
          dataKey="score"
          stroke="#d42c2cff"
          fill="url(#gradRadar)"
          fillOpacity={0.6}
          strokeWidth={2}
        />
        <defs>
          <linearGradient id="gradRadar" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
      </RadarChart>
    </ResponsiveContainer>
    {Object.entries(result.quality_breakdown || {}).map(([key, val]) => {
      const numeric = Number(val) || 0;
      const pct = Math.round((numeric / 10) * 100);
      const color =
        pct >= 70
          ? "bg-gradient-to-r from-green-400 to-lime-500"
          : pct >= 40
          ? "bg-gradient-to-r from-amber-400 to-orange-500"
          : "bg-gradient-to-r from-rose-500 to-pink-500";
      return (
        <motion.div
          key={key}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
            
          
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1 overflow-hidden">
            <motion.div
              className={`h-2 rounded-full ${color}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1 }}
            ></motion.div>
          </div>
        </motion.div>
      );
    })}
  </div>
</div>

{/* Recommendations */}
<div className="mt-6 bg-white bg-opacity-70 backdrop-blur-sm p-5 rounded-lg shadow-md border border-indigo-100">
  <h4 className="text-lg font-semibold mb-2 text-indigo-700">Recommendations 💡</h4>
  <ul className="space-y-3">
    {(result.recommendations || []).map((rec: string, idx: number) => (
      <motion.li
        key={idx}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.2 }}
        className="flex items-start gap-1 text-sm text-gray-700"
      >
        <span className="flex-shrink-0 flex items-start justify-start w-6 text-indigo-700 font-semibold text-xs mt-0.5">
          {idx + 1}. 
        </span>
        <span>{rec}</span>
      </motion.li>
    ))}
  </ul>
</div>

                        

                        {/* --- Related Stories & RAG Insights --- */}
<div className="mt-10">
  <h2 className="text-2xl font-bold text-indigo-700 mb-5 flex items-center gap-2">
    🧩 Related Stories & RAG Insights
  </h2>

  {/* Overall Score Trendline */}
  <div className="bg-white/60 backdrop-blur-md p-4 rounded-lg shadow-md border border-indigo-100 mb-8">
    <h4 className="text-sm font-semibold text-gray-700 mb-2">
      Final Score Distribution Across Related Stories
    </h4>
    <ResponsiveContainer width="100%" height={120}>
      <LineChart
        data={result.ranked_related_stories.map((s: any, i: number) => ({
          name: `Story-${i + 1}`,
          final: s.hybrid_score_final ?? s.hybrid_score ?? 0,
        }))}
      >
        <XAxis dataKey="name" hide />
        <YAxis hide domain={[0, 1]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{ background: "black", borderRadius: "8px", border: "1px solid #060705ff" }}
        />
        <Line
          type="monotone"
          dataKey="final"
          stroke="#f9f9fcff"
          strokeWidth={2.2}
          dot={{ r: 4, fill: "#f8f8fcff" }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>

  {/* Related Story Cards */}
  <div className="grid grid-cols-1 gap-6">
    {result.ranked_related_stories.map((s: any, i: number) => (
      <motion.div
        key={s._id || i}
        initial={{ opacity: 1, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.1 }}
        className="relative bg-gradient-to-br from-white via-indigo-50 to-purple-50 border border-indigo-100 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-5"
      >
        {/* Header Row */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-indigo-700">
              Story {i + 1} - {s.metadata.priority}
            </h3>
            <p className="text-sm text-gray-600 italic">
              {"Story - "  +s.content || "Unspecified Epic"}
            </p>
          </div>

 {/* Mini Bar Graph for Score Comparison */}

<div className="bg-white/80 border border-indigo-100 rounded-lg shadow-sm p-3 text-xs text-gray-700 flex items-center justify-between gap-3">
  {/* Left: Score Labels & Values */}
  <div className="grid grid-cols-2 gap-x-3 gap-y-1 flex-shrink-0 w-[130px]">
    <div className="text-red-600 font-medium">Vector</div>
    <div className="text-right font-mono text-gray-900">
      {(s.vector_score_norm ?? 0).toFixed(3)}
    </div>

    <div className="text-orange-600 font-medium">BM25</div>
    <div className="text-right font-mono text-gray-900">
      {(s.bm25_score_norm ?? 0).toFixed(3)}
    </div>

    <div className="text-green-600 font-medium">LLM</div>
    <div className="text-right font-mono text-gray-900">
      {(s.llm_score ?? 0).toFixed(3)}
    </div>

    <div className="text-gray-700 font-semibold">Final</div>
    <div className="text-right font-semibold text-indigo-600">
      {(s.hybrid_score_final ?? s.hybrid_score ?? 0).toFixed(3)}
    </div>
  </div>

  {/* Right: Compact Bar Chart */}
  <div className="flex-1 min-w-[120px] h-[75px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={[
          { name: "Vector", value: s.vector_score_norm ?? 0 },
          { name: "BM25", value: s.bm25_score_norm ?? 0 },
          { name: "LLM", value: s.llm_score ?? 0 },
          { name: "Final", value: s.hybrid_score_final ?? s.hybrid_score ?? 0 },
        ]}
        margin={{ left: 8, right: 10, top: 5, bottom: 5 }}
      >
        <XAxis type="number" domain={[0, 1]} hide />
        <YAxis dataKey="name" type="category" hide />
        <Tooltip
          cursor={{ fill: "rgba(99,102,241,0.08)" }}
          contentStyle={{
            background: "white",
            color: "black",
            borderRadius: "8px",
            border: "1px solid #ddd",
            fontSize: "0.75rem",
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 4, 4]}>
          {["#ef4444", "#f97316", "#10b981", "#6366f1"].map((color, index) => (
            <Cell key={`cell-${index}`} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>

        {/* <div className="flex-1 min-w-[120px] h-[75px]">
          <ResponsiveContainer width="100%" height={100}>
            <BarChart
              layout="vertical"
              data={[
                { name: "Vector", value: s.vector_score_norm ?? 0 },
                { name: "BM25", value: s.bm25_score_norm ?? 0 },
                { name: "LLM", value: s.llm_score ?? 0 },
                { name: "Final", value: s.hybrid_score_final ?? s.hybrid_score ?? 0 },
              ]}
              margin={{ left: 20, right: 20, top: 5, bottom: 5 }}
            >
              <YAxis type="number" domain={[0, 1]} />
              <XAxis dataKey="name" type="category" width={100} />
              <Tooltip
                cursor={{ fill: "rgba(99,102,241,0.1)" }}
                contentStyle={{
                  background: "black",
                  borderRadius: "8px",
                  border: "1px solid #ffffffff",
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 4, 4]}
              animationDuration={800}
  animationBegin={200}>
                {["#6366f1", "#8b5cf6", "#10b981", "#f59e0b"].map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div> */}
          {/* Score Panel */}
          {/* <div className="bg-white/80 border border-indigo-100 rounded-lg shadow-sm p-3 text-xs text-gray-700">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="text-red-600">Vector</div>
              <div className="text-right font-mono text-gray-900">
                {(s.vector_score_norm ?? 0).toFixed(3)}
              </div>
              <div className="text-black-600">BM25</div>
              <div className="text-right font-mono text-gray-900">
                {(s.bm25_score_norm ?? 0).toFixed(3)}
              </div>
              <div className="text-gray-600">LLM</div>
              <div className="text-right font-mono text-gray-900">
                {(s.llm_score ?? 0).toFixed(3)}
              </div>
              <div className="text-gray-600 font-semibold">Final</div>
              <div className="text-right font-semibold text-indigo-600">
                {(s.hybrid_score_final ?? s.hybrid_score ?? 0).toFixed(3)}
              </div>
            </div>
          </div> */}
        </div>

       

        {/* Story Content */}
        
 <div className="mb-4 bg-black/70 rounded-lg p-3 text-sm leading-relaxed shadow-inner border border-gray-100">
          <p className="text-gray-800 whitespace-pre-line">{"Acceptance Criteria - \n"+s.metadata.acceptanceCriteria}</p>
        </div>

        {/* Collapsible Insights */}
        <details className="group text-sm">
          <summary className="flex justify-between items-center cursor-pointer select-none font-semibold text-indigo-600 hover:text-indigo-800">
            <span className="flex text-orange-700">RAG Evidence & LLM Reasoning</span>
            <span className="transition-transform duration-300 group-open:rotate-180">▼</span>
          </summary>

          <div className="mt-3 bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-md shadow-inner border border-gray-200">
            <div className="mb-2">
              <strong className="text-gray-700">Snippet:</strong>
              <p className="text-sm text-gray-600 font-mono bg-white/60 p-2 rounded mt-1 border border-gray-100">
                {s.evidence || "No snippet available."}
              </p>
            </div>

            <div className="mb-3">
              <strong className="text-gray-700">LLM Reason:</strong>
              <p className="text-sm text-gray-700 mt-1 bg-white/60 p-2 rounded border border-gray-100">
                {s.llm_reason || "No reasoning provided."}
              </p>
            </div>

            <div>
              <strong className="text-gray-700">Score Breakdown:</strong>
              <div className="grid grid-cols-4 gap-3 mt-2">
                {[
                  { label: "Vector", value: s.vector_score_norm },
                  { label: "BM25", value: s.bm25_score_norm },
                  { label: "LLM", value: s.llm_score },
                  { label: "Final", value: s.hybrid_score_final ?? s.hybrid_score ?? 0 },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white/70 rounded-md p-2 text-center shadow-sm border border-gray-100"
                  >
                    <p className="text-[11px] text-gray-500">{item.label}</p>
                    <p className="text-sm font-semibold text-indigo-700">
                      {(item.value ?? 0).toFixed(3)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </details>
      </motion.div>
    ))}
  </div>
</div>

                        {result.errors && result.errors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded p-4">
                                <h2 className="text-red-800 font-semibold mb-2">Errors</h2>
                                <ul className="list-disc pl-5">
                                    {result.errors.map((error: { message: string }, index: number) => (
                                        <li key={index} className="text-red-700">{error.message}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
}

