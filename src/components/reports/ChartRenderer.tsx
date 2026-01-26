import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import html2canvas from "html2canvas";

// Color constants for consistent styling
const SENTIMENT_COLORS = {
  positivo: "#22c55e",
  neutral: "#3b82f6",
  negativo: "#ef4444",
};

const TREND_COLORS = {
  menciones: "#8b5cf6",
  positivo: "#22c55e",
  neutral: "#3b82f6",
  negativo: "#ef4444",
};

interface SentimentData {
  name: string;
  value: number;
  color: string;
}

interface TrendData {
  date: string;
  menciones: number;
  positivo: number;
  neutral: number;
  negativo: number;
}

interface SourceData {
  domain: string;
  mentions: number;
  sentiment: number;
}

export interface ChartRendererHandle {
  captureSentimentChart: () => Promise<string | null>;
  captureTrendsChart: () => Promise<string | null>;
  captureSourcesChart: () => Promise<string | null>;
}

interface ChartRendererProps {
  sentimentData: SentimentData[];
  trendsData: TrendData[];
  sourcesData: SourceData[];
  onReady?: () => void;
}

export const ChartRenderer = forwardRef<ChartRendererHandle, ChartRendererProps>(
  ({ sentimentData, trendsData, sourcesData, onReady }, ref) => {
    const sentimentRef = useRef<HTMLDivElement>(null);
    const trendsRef = useRef<HTMLDivElement>(null);
    const sourcesRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
      // Wait for charts to render
      const timer = setTimeout(() => {
        setIsReady(true);
        onReady?.();
      }, 1000);
      return () => clearTimeout(timer);
    }, [onReady]);

    const captureChart = async (element: HTMLDivElement | null): Promise<string | null> => {
      if (!element) return null;

      try {
        const canvas = await html2canvas(element, {
          backgroundColor: "#ffffff",
          scale: 2,
          logging: false,
          useCORS: true,
        });
        return canvas.toDataURL("image/png");
      } catch (error) {
        console.error("Error capturing chart:", error);
        return null;
      }
    };

    useImperativeHandle(ref, () => ({
      captureSentimentChart: () => captureChart(sentimentRef.current),
      captureTrendsChart: () => captureChart(trendsRef.current),
      captureSourcesChart: () => captureChart(sourcesRef.current),
    }));

    return (
      <div
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "800px",
          backgroundColor: "#ffffff",
        }}
      >
        {/* Sentiment Pie Chart */}
        <div
          ref={sentimentRef}
          style={{
            width: "400px",
            height: "300px",
            backgroundColor: "#ffffff",
            padding: "20px",
          }}
        >
          <h3 style={{ textAlign: "center", marginBottom: "10px", color: "#1f2937", fontSize: "16px" }}>
            Distribución de Sentimiento
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={sentimentData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {sentimentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Trends Area Chart */}
        <div
          ref={trendsRef}
          style={{
            width: "700px",
            height: "350px",
            backgroundColor: "#ffffff",
            padding: "20px",
          }}
        >
          <h3 style={{ textAlign: "center", marginBottom: "10px", color: "#1f2937", fontSize: "16px" }}>
            Evolución Temporal de Menciones
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="positivo"
                stackId="1"
                stroke={TREND_COLORS.positivo}
                fill={TREND_COLORS.positivo}
                fillOpacity={0.6}
                name="Positivo"
              />
              <Area
                type="monotone"
                dataKey="neutral"
                stackId="1"
                stroke={TREND_COLORS.neutral}
                fill={TREND_COLORS.neutral}
                fillOpacity={0.6}
                name="Neutral"
              />
              <Area
                type="monotone"
                dataKey="negativo"
                stackId="1"
                stroke={TREND_COLORS.negativo}
                fill={TREND_COLORS.negativo}
                fillOpacity={0.6}
                name="Negativo"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sources Bar Chart */}
        <div
          ref={sourcesRef}
          style={{
            width: "600px",
            height: "350px",
            backgroundColor: "#ffffff",
            padding: "20px",
          }}
        >
          <h3 style={{ textAlign: "center", marginBottom: "10px", color: "#1f2937", fontSize: "16px" }}>
            Top Fuentes por Menciones
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sourcesData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#6b7280" />
              <YAxis
                type="category"
                dataKey="domain"
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
                width={90}
              />
              <Tooltip />
              <Bar dataKey="mentions" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Menciones" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }
);

ChartRenderer.displayName = "ChartRenderer";
