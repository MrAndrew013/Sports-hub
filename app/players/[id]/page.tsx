'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

interface Player {
  id: string;
  name: string;
  number?: number;
  position?: string;
  team_id: string;
  team?: {
    id: string;
    name: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    bg_color?: string;
    text_color?: string;
    theme_mode?: 'dark' | 'light';
  };
}

interface MatchStat {
  id: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  match: {
    id: string;
    match_date: string;
    round?: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number;
    away_score: number;
    home_team?: { name: string; logo_url?: string };
    away_team?: { name: string; logo_url?: string };
  };
}

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.id as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchPlayerData = useCallback(async () => {
    if (!playerId) return;

    // 1. Φόρτωση Στοιχείων Παικτή και της Ομάδας του
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('*, team:teams(*)')
      .eq('id', playerId)
      .single();

    if (playerError || !playerData) {
      setLoading(false);
      return;
    }
    setPlayer(playerData as Player);

    // 2. Φόρτωση Στατιστικών Παικτή από κάθε Αγώνα
    const { data: statsData } = await supabase
      .from('match_player_stats')
      .select(`
        *,
        match:matches(
          *,
          home_team:teams!matches_home_team_id_fkey(name, logo_url),
          away_team:teams!matches_away_team_id_fkey(name, logo_url)
        )
      `)
      .eq('player_id', playerId);

    if (statsData) {
      const sorted = (statsData as unknown as MatchStat[]).sort(
        (a, b) =>
          new Date(b.match?.match_date || 0).getTime() -
          new Date(a.match?.match_date || 0).getTime()
      );
      setMatchStats(sorted);
    }

    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    fetchPlayerData();
  }, [playerId, fetchPlayerData]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-400 flex items-center justify-center text-sm">
        Loading player stats...
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-300 flex flex-col items-center justify-center space-y-4">
        <p className="text-lg">Player not found.</p>
        <Link href="/matches" className="text-cyan-400 hover:underline text-sm">
          ← Back to matches
        </Link>
      </div>
    );
  }

  // Υπολογισμός Μέσων Όρων (Season Averages)
  const totalGames = matchStats.length;
  const avgPoints = totalGames ? (matchStats.reduce((acc, curr) => acc + (curr.points || 0), 0) / totalGames).toFixed(1) : '0.0';
  const avgRebounds = totalGames ? (matchStats.reduce((acc, curr) => acc + (curr.rebounds || 0), 0) / totalGames).toFixed(1) : '0.0';
  const avgAssists = totalGames ? (matchStats.reduce((acc, curr) => acc + (curr.assists || 0), 0) / totalGames).toFixed(1) : '0.0';
  const avgSteals = totalGames ? (matchStats.reduce((acc, curr) => acc + (curr.steals || 0), 0) / totalGames).toFixed(1) : '0.0';
  const avgBlocks = totalGames ? (matchStats.reduce((acc, curr) => acc + (curr.blocks || 0), 0) / totalGames).toFixed(1) : '0.0';

  // Στυλ / Χρώματα Ομάδας
  const team = player.team;
  const isLight = team?.theme_mode === 'light';
  const primaryColor = team?.primary_color || '#0284c7';
  const secondaryColor = team?.secondary_color || (isLight ? '#ffffff' : '#0f172a');
  const pageBgColor = team?.bg_color || (isLight ? '#f8fafc' : '#090d16');
  const fontColor = team?.text_color || (isLight ? '#0f172a' : '#ffffff');

  return (
    <div
      suppressHydrationWarning
      style={{ backgroundColor: pageBgColor, color: fontColor }}
      className="min-h-screen py-10 px-4 sm:px-6 transition-colors duration-300"
    >
      <main className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div className="flex justify-between items-center text-xs opacity-80 font-medium">
          {team ? (
            <Link href={`/teams/${team.id}`} className="hover:opacity-100 transition">
              ← Back to {team.name}
            </Link>
          ) : (
            <Link href="/matches" className="hover:opacity-100 transition">
              ← Back to Matches
            </Link>
          )}
          <Link href="/" className="hover:opacity-100 transition">
            Admin Panel
          </Link>
        </div>

        {/* Player Header Banner */}
        <div
          style={{ backgroundColor: secondaryColor, borderColor: primaryColor }}
          className="p-6 sm:p-8 rounded-2xl border-2 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-6 text-center sm:text-left">
            <div
              style={{ backgroundColor: primaryColor }}
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-xl shrink-0"
            >
              #{player.number || '—'}
            </div>

            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold uppercase tracking-wider opacity-80">
                <span>{team?.name || 'Free Agent'}</span>
                {player.position && <span>● Position: {player.position}</span>}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black mt-1">{player.name}</h1>
              <p className="text-xs opacity-75 font-medium mt-1">Player Statistics Profile</p>
            </div>
          </div>

          {team?.logo_url && (
            <img
              src={team.logo_url}
              alt={team.name}
              className="w-16 h-16 object-contain bg-black/10 rounded-2xl p-2 border border-black/10 shrink-0"
            />
          )}
        </div>

        {/* Average Season Stats Cards */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider opacity-80">
            📊 Season Averages ({totalGames} Games Played)
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'PPG', name: 'Points', value: avgPoints },
              { label: 'RPG', name: 'Rebounds', value: avgRebounds },
              { label: 'APG', name: 'Assists', value: avgAssists },
              { label: 'SPG', name: 'Steals', value: avgSteals },
              { label: 'BPG', name: 'Blocks', value: avgBlocks },
            ].map((stat, idx) => (
              <div
                key={idx}
                style={{ backgroundColor: secondaryColor }}
                className="p-4 rounded-xl border border-black/10 text-center shadow-lg"
              >
                <div className="text-[10px] font-bold uppercase opacity-70">{stat.name}</div>
                <div
                  style={{ color: primaryColor }}
                  className="text-2xl sm:text-3xl font-black mt-1"
                >
                  {stat.value}
                </div>
                <div className="text-[10px] font-bold opacity-50 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Match-by-Match Performance Table */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider opacity-80">
            🏀 Match-by-Match Performance
          </h2>

          <div
            style={{ backgroundColor: secondaryColor }}
            className="rounded-2xl border border-black/10 overflow-hidden shadow-2xl"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/25 text-xs uppercase tracking-wider font-bold border-b border-black/10">
                  <tr>
                    <th className="p-4">Match</th>
                    <th className="p-4 text-center">Score</th>
                    <th className="p-4 text-center">PTS</th>
                    <th className="p-4 text-center">REB</th>
                    <th className="p-4 text-center">AST</th>
                    <th className="p-4 text-center">STL</th>
                    <th className="p-4 text-center">BLK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 font-medium">
                  {matchStats.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 opacity-60 text-xs italic">
                        No match statistics logged for this player yet.
                      </td>
                    </tr>
                  ) : (
                    matchStats.map((ms) => {
                      const m = ms.match;
                      if (!m) return null;

                      return (
                        <tr key={ms.id} className="hover:bg-black/10 transition">
                          <td className="p-4">
                            <div className="font-bold text-xs sm:text-sm">
                              {m.home_team?.name} vs {m.away_team?.name}
                            </div>
                            <div className="text-[11px] opacity-60 mt-0.5">
                              {m.round || 'Round 1'} • {new Date(m.match_date).toLocaleDateString('en-US')}
                            </div>
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-xs opacity-90">
                            {m.home_score} - {m.away_score}
                          </td>
                          <td
                            style={{ color: primaryColor }}
                            className="p-4 text-center font-black text-base bg-black/10"
                          >
                            {ms.points || 0}
                          </td>
                          <td className="p-4 text-center font-bold">{ms.rebounds || 0}</td>
                          <td className="p-4 text-center font-bold">{ms.assists || 0}</td>
                          <td className="p-4 text-center font-bold">{ms.steals || 0}</td>
                          <td className="p-4 text-center font-bold">{ms.blocks || 0}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}