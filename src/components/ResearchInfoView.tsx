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
            民間やSNSで「前兆現象」と主張される情報は、地震発生後の想起バイアスや、低気圧・強風・生活音など別の要因でも説明できる可能性があります。そのため、因果関係を前提にせず対照期間と交絡要因を分けて検証します。
          </p>
          <p>
            本プラットフォームでは、「地震が起きるかどうか」を予測・警告するのではなく、<strong>利用可能な実測履歴（気象は過去30日の同一地域・同一時間帯）と比べて、現在の観測データが統計的にどれだけ珍しいか</strong>を算出します。履歴が不足するSNS・市民観測は推測値を置かず、データ不足として扱います。
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
              Score = 100 / (1 + exp(-1.15 × (|Z_robust| - 2.0)))
            </div>
            <span className="text-[11px] font-sans text-slate-500 block">
              ※ロジスティック変換で外れ値の影響を抑えます。品質Qはスコアとは別に表示し、低品質データを「正常」に見せない設計です。
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
              ブラウザ内のWeb Audio APIで音量・無音率・クリッピング等の信号品質だけを算出し、音の種類は利用者が確認します。録音された生音声は解析完了と同時にメモリから破棄され、サーバへ送信しません。
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-2">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-cyan-500" />
              元写真・EXIFを保存しない端末内解析
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              選択した写真はブラウザ内で縮小して画素解析し、元ファイルやEXIFを保存・送信しません。記録する位置は端末GPSではなく、利用者が選択した代表地域の中心座標です。現在の観測は外部公開しません。
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
            <span><a href="https://www.jma.go.jp/jma/kishou/know/faq/faq24.html" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">気象庁「地震予知について」 <ExternalLink className="w-3 h-3 inline" /></a>: 確度の高い日時・場所・規模の予測が難しいこと、および「地震雲」の科学的説明が確立していないことに関する公式見解。</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span><a href="https://www.p2pquake.net/develop/json_api_v2/" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">P2P地震情報 API v2 <ExternalLink className="w-3 h-3 inline" /></a>: 気象庁発表に基づく地震情報（震源・震度）の配信基盤。本アプリは現在、地震情報コード551を取得します。</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span><a href="https://open-meteo.com/en/docs" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Open-Meteo Weather API <ExternalLink className="w-3 h-3 inline" /></a>: 利用地点に応じた気象モデルに基づく雲量・海面気圧・地上風速データと、過去30日の同時間帯比較値。</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span><a href="https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/searchPostsV2.json" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Bluesky AT Protocol Lexicon <ExternalLink className="w-3 h-3 inline" /></a>: 公開検索V2と公開プロフィール投稿を取得。投稿者識別子はサーバーで不可逆ハッシュ化します。</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span><strong>端末内音響品質解析:</strong> Web Audio APIによるRMS音量・無音率・クリッピング・簡易会話比率。現時点では音源分類AIを使用していません。</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
