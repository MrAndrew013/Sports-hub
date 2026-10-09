'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Match {
  id: string;
  round?: string;
  match_date: string;
  status: 'scheduled' | 'live' | 'finished';
  home_score: number;
  away_score: number;
  home_team?: { name: string; logo_url?: string };
  away_team?: { name: string; logo_url?: string };
  leagues?: { name: string; logo_url?: string };
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const fetchMatches = async () => {
    const { data } = await supabase
      .from('matches')
      .select(`
        id,
        round,
        match_date,
        status,
        home_score,
        away_score,
        home_team:teams!matches_home_team_id_fkey(name, logo_url),
        away_team:teams!matches_away_team_id_fkey(name, logo_url),
        leagues(name, logo_url)
      `)
      .order('match_date', { ascending: true });

    if (data) setMatches(data as unknown as Match[]);
    setLoading(false);
  };

  useEffect(() => {
    setMounted(true);
    fetchMatches();

    const channel = supabase
      .channel('matches-realtime-feed')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#090d16] text-white py-12 px-4 sm:px-6">
      <main className="max-w-3xl mx-auto space-y-3">
        {loading ? (
          <div className="text-center py-20 text-slate-500 font-mono text-sm animate-pulse">
            Loading fixtures...
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-500 text-sm">
            No matches scheduled yet.
          </div>
        ) : (
          matches.map((m) => {
            const homeWon = m.status === 'finished' && m.home_score > m.away_score;
            const awayWon = m.status === 'finished' && m.away_score > m.home_score;

            const timeStr = mounted
              ? new Date(m.match_date).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            const dateStr = mounted
              ? new Date(m.match_date).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })
              : '';

            return (
              <div
                key={m.id}
                className="group relative rounded-xl bg-[#0f172a] border border-slate-800 hover:border-slate-700 transition p-4 shadow-sm"
              >
                {/* Header: League Logo + Name + Round badge & Status */}
                <div className="flex items-center justify-between text-xs text-slate-400 mb-3 pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    {m.leagues?.logo_url ? (
                      <img
                        src={m.leagues.logo_url}
                        alt=""
                        className="w-5 h-5 object-contain rounded bg-slate-800 p-0.5"
                      />
                    ) : (
                      <span className="text-xs">🏆</span>
                    )}
                    <span className="font-semibold text-slate-200">
                      {m.leagues?.name || 'Tournament'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 text-[10px] font-semibold border border-slate-700/60">
                      {m.round || 'Round 1'}
                    </span>
                  </div>

                  {m.status === 'live' ? (
                    <span className="flex items-center gap-1.5 text-rose-400 font-bold tracking-wider text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      LIVE
                    </span>
                  ) : m.status === 'finished' ? (
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      FT
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-400">
                      {dateStr} • {timeStr}
                    </span>
                  )}
                </div>

                {/* Score row */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  {/* Home Team */}
                  <div className="flex items-center gap-3 justify-end">
                    <span
                      className={`text-sm sm:text-base text-right truncate ${
                        homeWon
                          ? 'font-bold text-white'
                          : m.status === 'finished'
                          ? 'text-slate-400 font-medium'
                          : 'text-slate-200 font-medium'
                      }`}
                    >
                      {m.home_team?.name || 'Home'}
                    </span>
                    {m.home_team?.logo_url ? (
                      <img
                        src={m.home_team.logo_url}
                        alt=""
                        className="w-8 h-8 rounded-full object-contain shrink-0 bg-slate-800 p-0.5"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                        {m.home_team?.name?.charAt(0) || 'H'}
                      </div>
                    )}
                  </div>

                  {/* Center Score / VS Box */}
                  <div className="min-w-[70px] text-center">
                    {m.status === 'scheduled' ? (
                      <span className="px-2.5 py-1 text-xs font-mono font-bold text-slate-400 bg-slate-800/80 rounded border border-slate-700">
                        VS
                      </span>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-black/40 border border-slate-800">
                        <span
                          className={`text-lg sm:text-xl font-mono font-bold ${
                            homeWon ? 'text-white' : 'text-slate-400'
                          }`}
                        >
                          {m.home_score}
                        </span>
                        <span className="text-slate-600 font-mono">-</span>
                        <span
                          className={`text-lg sm:text-xl font-mono font-bold ${
                            awayWon ? 'text-white' : 'text-slate-400'
                          }`}
                        >
                          {m.away_score}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center gap-3 justify-start">
                    {m.away_team?.logo_url ? (
                      <img
                        src={m.away_team.logo_url}
                        alt=""
                        className="w-8 h-8 rounded-full object-contain shrink-0 bg-slate-800 p-0.5"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                        {m.away_team?.name?.charAt(0) || 'A'}
                      </div>
                    )}
                    <span
                      className={`text-sm sm:text-base text-left truncate ${
                        awayWon
                          ? 'font-bold text-white'
                          : m.status === 'finished'
                          ? 'text-slate-400 font-medium'
                          : 'text-slate-200 font-medium'
                      }`}
                    >
                      {m.away_team?.name || 'Away'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}