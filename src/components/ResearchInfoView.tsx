import React from 'react';
import { 
  BookOpen, 
  ShieldCheck, 
  Database, 
  Activity, 
  Lock, 
  Mic, 
  Camera, 
  Sparkles, 
  FileText, 
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

export const ResearchInfoView: React.FC = () => {
  return (
    <div id="research-info-view" className="space-y-6 max-w-5xl mx-auto px-3 sm:px-6 py-6 text-slate-700 dark:text-slate-300">
      
      {/* タイトル */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-xl">
              科学的根拠とシステム仕様 (Methodology & Privacy)
            </h2>
            <span className="text-xs text-slate-500">
              EarthSignal アーキテクチャ・統計モデル・プライバシー保護規定
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          EarthSignalは、非科学的な「地震予知・前兆占い」を排し、オープンデータと市民センシングによる客観的な統計観測基盤を提供するために設計されました。
        </p>
      </div>

      {/* 1. 地震予知に関する科学的見解 */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          1. なぜ「予知」ではなく「観測異常度」なのか
        </h3>

        <div className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          <p>
            現代の地震学および気象庁の公式見解において、<strong>「日時・場所・規模を特定した確度の高い地震予知手法」は確立されていません</strong>。
          </p>
          <p>
            過去に民間やSNSで「前兆現象」と主張された事例の多くは、地震発生後に偶然の出来事を後付けで結びつける「想起バイアス（Confirmation Bias）」や、低気圧接近に伴う気象現象（大気擾乱による雲の筋や強風音）であることが学術的に示されています。
          </p>
          <p>
            本プラットフォームでは、「地震が起きるかどうか」を予測・警告するのではなく、<strong>「過去30日間の同一地域・同一時間帯のベースラインと比べて、現在の観測データが統計的にどれだけ珍しい状態にあるか（Robust Z-Score）」</strong>を客観的指標として算出・蓄積し、学術的な事後検証に供することを目的としています。
          </p>
        </div>
      </div>

      {/* 2. 統計アルゴリズム */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-600" />
          2. ロバスト統計・異常度算出数式 (第10章・第11章)
        </h3>

        <div className="space-y-3 text-xs leading-relaxed">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 font-mono text-slate-800 dark:text-slate-200 space-y-2">
            <span className="text-[11px] font-sans font-bold text-slate-500 block">■ ロバストZスコア (MAD基準):</span>
            <div className="text-center py-1 text-sm text-indigo-600 dark:text-indigo-400 font-bold">
              Z_robust = (x - Median) / (1.4826 * MAD + ε)
            </div>
            <span className="text-[11px] font-sans text-slate-500 block">
              ※外れ値の影響を受けやすい平均・分散ではなく、中央値と中央絶対偏差 (MAD) を採用。
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 font-mono text-slate-800 dark:text-slate-200 space-y-2">
            <span className="text-[11px] font-sans font-bold text-slate-500 block">■ 観測異常度スコア変換 (0〜100):</span>
            <div className="text-center py-1 text-sm text-purple-600 dark:text-purple-400 font-bold">
              Score = min(100, max(0, (|Z_robust| / 3.0) * 100 * Q))
            </div>
            <span className="text-[11px] font-sans text-slate-500 block">
              ※k=3.0 (3シグマ相当) で100点に到達。Qは標本数・風速ノイズによる品質係数 (0.0〜1.0)。
            </span>
          </div>
        </div>
      </div>

      {/* 3. プライバシー保護と自動破棄 */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
          <Lock className="w-5 h-5 text-emerald-600" />
          3. 市民センシングとプライバシー保護 (第22章)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-2">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-indigo-500" />
              10秒音響の生音声即時破棄
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              ブラウザまたは端末側でWeb Audio API / YAMNetを用いて周波数特徴量とクラス確率のみを抽出。録音された生音声データは解析完了と同時に破棄され、サーバに長期保管されません。
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-2">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-cyan-500" />
              EXIFメタデータの自動除去
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              アップロードされた写真から、自宅住所が特定されるGPS緯度経度・端末固有情報を即座にストリップ（除去）します。公開される位置はH3地理セルの中心座標に丸められます。
            </p>
          </div>
        </div>
      </div>

      {/* 4. 出典・オープンデータ */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white text-base">
          4. 外部データ出典 & 参考文献
        </h3>

        <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-400">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span><strong>P2P地震情報 API v2:</strong> 気象庁が発表する緊急地震速報・地震情報（震源・震度）のリアルタイム配信基盤。</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span><strong>Open-Meteo Weather API:</strong> 気象庁GSM/ECMWF等の全球気象数値予報モデルに基づく雲量・海面気圧・地上風速データ。</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span><strong>YAMNet / AudioSet (Google Research):</strong> 521カテゴリの環境音・動物鳴き声を分類するディープニューラルネットワーク。</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
