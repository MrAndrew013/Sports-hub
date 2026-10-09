'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

interface League {
  id: string;
  name: string;
  sport: string;
  season: string;
  logo_url?: string;
}

interface Team {
  id: string;
  name: string;
  logo_url?: string;
  theme_mode?: 'dark' | 'light';
  primary_color?: string;
  secondary_color?: string;
  bg_color?: string;
  text_color?: string;
}

interface PlayerStat {
  id: string;
  player_id: string;
  team_id: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  player?: { name: string; number?: number; position?: string };
}

interface Match {
  id: string;
  league_id: string;
  round?: string;
  match_date: string;
  status: 'scheduled' | 'live' | 'finished';
  home_score: number;
  away_score: number;
  home_team_id: string;
  away_team_id: string;
  home_team?: { name: string; logo_url?: string };
  away_team?: { name: string; logo_url?: string };
  leagues?: { id: string; name: string; season: string; logo_url?: string; sport?: string };
}

export default function TeamSeasonPage() {
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participatingLeagues, setParticipatingLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Box Score State
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [matchStats, setMatchStats] = useState<Record<string, PlayerStat[]>>({});
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchTeamData = useCallback(async () => {
    if (!teamId) return;

    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError || !teamData) {
      setLoading(false);
      return;
    }

    setTeam(teamData as unknown as Team);

    const { data: ltData } = await supabase
      .from('league_teams')
      .select('league_id')
      .eq('team_id', teamId);

    if (ltData && ltData.length > 0) {
      const leagueIds = ltData.map((l) => l.league_id);
      const { data: leaguesData } = await supabase
        .from('leagues')
        .select('*')
        .in('id', leagueIds);

      if (leaguesData) {
        setParticipatingLeagues(leaguesData as League[]);
      }
    }

    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(`
        id,
        league_id,
        round,
        match_date,
        status,
        home_score,
        away_score,
        home_team_id,
        away_team_id,
        home_team:teams!matches_home_team_id_fkey(name, logo_url),
        away_team:teams!matches_away_team_id_fkey(name, logo_url),
        leagues(id, name, season, logo_url, sport)
      `)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('match_date', { ascending: true });

    if (!matchError && matchData) {
      setMatches(matchData as unknown as Match[]);
    }

    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchTeamData();
  }, [teamId, fetchTeamData]);

  // Φόρτωση Box Score ΜΟΝΟ για την τρέχουσα ομάδα
  const toggleBoxScore = async (matchId: string) => {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
      return;
    }

    setExpandedMatchId(matchId);

    if (!matchStats[matchId]) {
      setLoadingStats(true);
      const { data } = await supabase
        .from('match_player_stats')
        .select(`
          id,
          player_id,
          team_id,
          points,
          rebounds,
          assists,
          steals,
          blocks,
          player:players(name, number, position)
        `)
        .eq('match_id', matchId)
        .eq('team_id', teamId); // ΑΠΟΚΛΕΙΣΤΙΚΑ ΜΟΝΟ ΓΙΑ ΤΗΝ ΟΜΑΔΑ ΤΗΣ ΣΕΛΙΔΑΣ

      if (data) {
        setMatchStats((prev) => ({
          ...prev,
          [matchId]: data as unknown as PlayerStat[],
        }));
      }
      setLoadingStats(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-400 flex items-center justify-center text-sm">
        Loading team page...
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-300 flex flex-col items-center justify-center space-y-4">
        <p className="text-lg">Team not found.</p>
        <Link href="/matches" className="text-cyan-400 hover:underline text-sm">
          ← Back to matches
        </Link>
      </div>
    );
  }

  const isLight = team.theme_mode === 'light';
  const primaryColor = team.primary_color || '#0284c7';
  const secondaryColor = team.secondary_color || (isLight ? '#ffffff' : '#0f172a');
  const pageBgColor = team.bg_color || (isLight ? '#f8fafc' : '#090d16');
  const fontColor = team.text_color || (isLight ? '#0f172a' : '#ffffff');

  const filteredMatches = matches.filter((m) => {
    if (!selectedLeagueId || selectedLeagueId === 'all') return true;
    return m.league_id === selectedLeagueId;
  });

  const finishedMatches = filteredMatches.filter((m) => m.status === 'finished');
  let wins = 0;
  let draws = 0;
  let losses = 0;

  finishedMatches.forEach((m) => {
    const isHome = m.home_team_id === teamId;
    const teamScore = isHome ? m.home_score : m.away_score;
    const oppScore = isHome ? m.away_score : m.home_score;

    if (teamScore > oppScore) wins++;
    else if (teamScore === oppScore) draws++;
    else losses++;
  });

  const activeLeagueInfo =
    selectedLeagueId !== 'all'
      ? participatingLeagues.find((l) => l.id === selectedLeagueId)
      : participatingLeagues[0];

  return (
    <div
      style={{
        backgroundColor: pageBgColor,
        color: fontColor,
      }}
      className="min-h-screen py-10 px-4 sm:px-6 transition-colors duration-300"
    >
      <main className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center text-xs opacity-80 font-medium">
          <Link href="/matches" className="hover:opacity-100 transition">
            ← All Matches
          </Link>
          <Link href="/" className="hover:opacity-100 transition">
            Admin Panel
          </Link>
        </div>

        {/* Team Banner */}
        <div
          style={{
            backgroundColor: secondaryColor,
            borderColor: primaryColor,
          }}
          className="p-6 sm:p-8 rounded-2xl border-2 shadow-2xl flex flex-col sm:flex-row items-center sm:justify-between gap-6"
        >
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {team.logo_url ? (
              <img
                src={team.logo_url}
                alt={team.name}
                className="w-20 h-20 rounded-2xl object-contain p-2 border bg-black/10 border-black/20 shadow-md shrink-0"
              />
            ) : (
              <div
                style={{ backgroundColor: primaryColor }}
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg shrink-0"
              >
                {team.name.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{team.name}</h1>
                <span
                  style={{ color: primaryColor }}
                  className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/10 border border-black/10"
                >
                  ● {team.theme_mode || 'dark'}
                </span>
              </div>

              {activeLeagueInfo && (
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 text-sm sm:text-base">
                  {activeLeagueInfo.logo_url ? (
                    <img
                      src={activeLeagueInfo.logo_url}
                      alt=""
                      className="w-5 h-5 object-contain rounded-md bg-black/10 p-0.5"
                    />
                  ) : (
                    <span className="text-base">🏆</span>
                  )}
                  <span className="font-glitch-arcade text-base">
                    {activeLeagueInfo.name}
                  </span>
                  <span className="text-xs opacity-75 font-semibold uppercase tracking-wider">
                    ({activeLeagueInfo.sport})
                  </span>
                </div>
              )}
            </div>
          </div>

          {participatingLeagues.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                Competition:
              </span>
              <select
                value={selectedLeagueId}
                onChange={(e) => setSelectedLeagueId(e.target.value)}
                style={{
                  borderColor: primaryColor,
                  backgroundColor: secondaryColor,
                  color: fontColor,
                }}
                className="text-sm rounded-xl px-3 py-1.5 focus:outline-none border-2 font-bold shadow-sm"
              >
                <option value="all">All Competitions</option>
                {participatingLeagues.map((lg) => (
                  <option key={lg.id} value={lg.id}>
                    {lg.name} ({lg.season})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div
            style={{ backgroundColor: secondaryColor }}
            className="p-3 rounded-xl border border-black/10 text-center shadow-sm"
          >
            <span className="block text-[11px] uppercase font-bold opacity-70 tracking-wider">
              Played
            </span>
            <span className="text-lg font-black mt-0.5 block">{finishedMatches.length}</span>
          </div>

          <div
            style={{ backgroundColor: secondaryColor }}
            className="p-3 rounded-xl border border-black/10 text-center shadow-sm"
          >
            <span className="block text-[11px] text-emerald-500 uppercase font-bold tracking-wider">Wins</span>
            <span className="text-lg font-black text-emerald-500 mt-0.5 block">{wins}</span>
          </div>

          <div
            style={{ backgroundColor: secondaryColor }}
            className="p-3 rounded-xl border border-black/10 text-center shadow-sm"
          >
            <span className="block text-[11px] text-amber-500 uppercase font-bold tracking-wider">Draws</span>
            <span className="text-lg font-black text-amber-500 mt-0.5 block">{draws}</span>
          </div>

          <div
            style={{ backgroundColor: secondaryColor }}
            className="p-3 rounded-xl border border-black/10 text-center shadow-sm"
          >
            <span className="block text-[11px] text-rose-500 uppercase font-bold tracking-wider">Losses</span>
            <span className="text-lg font-black text-rose-500 mt-0.5 block">{losses}</span>
          </div>
        </div>

        {/* Fixtures List */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest opacity-80">
            Fixtures & Results ({filteredMatches.length})
          </h2>

          {filteredMatches.length === 0 ? (
            <div
              style={{ backgroundColor: secondaryColor }}
              className="text-center py-12 rounded-xl border border-black/10 text-sm opacity-70"
            >
              No matches found.
            </div>
          ) : (
            filteredMatches.map((m) => {
              const isHome = m.home_team_id === teamId;
              const teamScore = isHome ? m.home_score : m.away_score;
              const oppScore = isHome ? m.away_score : m.home_score;
              const hasWon = m.status === 'finished' && teamScore > oppScore;
              const hasLost = m.status === 'finished' && teamScore < oppScore;
              const isBasketball = m.leagues?.sport?.toLowerCase() === 'basketball';

              const timeStr = mounted
                ? new Date(m.match_date).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })
                : '';

              const dateStr = mounted
                ? new Date(m.match_date).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })
                : '';

              const isExpanded = expandedMatchId === m.id;
              const currentMatchStats = matchStats[m.id] || [];

              return (
                <div
                  key={m.id}
                  style={{ backgroundColor: secondaryColor }}
                  className="rounded-2xl border border-black/10 p-5 space-y-4 shadow-md transition hover:border-black/25"
                >
                  <div className="flex items-center justify-between text-xs pb-3 border-b border-black/10 gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {m.leagues?.logo_url ? (
                        <img
                          src={m.leagues.logo_url}
                          alt=""
                          className="w-6 h-6 object-contain rounded-md bg-black/10 p-0.5 shadow-sm"
                        />
                      ) : (
                        <span className="text-lg">🏆</span>
                      )}
                      
                      <span className="font-glitch-arcade text-sm sm:text-base">
                        {m.leagues?.name}
                      </span>
                      
                      <span
                        style={{ borderColor: primaryColor }}
                        className="px-2.5 py-0.5 rounded-md text-xs font-bold border bg-black/10 tracking-wide"
                      >
                        {m.round || 'Round 1'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {m.status === 'live' ? (
                        <span className="flex items-center gap-1.5 text-rose-500 font-extrabold text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                          LIVE
                        </span>
                      ) : m.status === 'finished' ? (
                        <span
                          className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-md ${
                            hasWon
                              ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                              : hasLost
                              ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                          }`}
                        >
                          {hasWon ? 'Win' : hasLost ? 'Loss' : 'Draw'}
                        </span>
                      ) : (
                        <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                          {dateStr} • {timeStr}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Team Fixture Row */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6 py-1">
                    {/* Home Team */}
                    <div className="flex items-center gap-3 justify-end">
                      <span
                        style={{
                          color: m.home_team_id === teamId ? primaryColor : undefined,
                        }}
                        className={`text-base sm:text-lg text-right truncate ${
                          m.home_team_id === teamId ? 'font-black' : 'font-bold'
                        }`}
                      >
                        {m.home_team?.name || 'Home'}
                      </span>
                      {m.home_team?.logo_url ? (
                        <img
                          src={m.home_team.logo_url}
                          alt=""
                          className="w-10 h-10 rounded-xl object-contain shrink-0 p-1 bg-black/10 border border-black/10 shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 bg-black/20 shadow-sm">
                          {m.home_team?.name?.charAt(0) || 'H'}
                        </div>
                      )}
                    </div>

                    {/* Central Score / VS */}
                    <div className="min-w-[70px] text-center">
                      {m.status === 'scheduled' ? (
                        <span className="text-xs font-black tracking-widest px-2.5 py-1 rounded-lg bg-black/15 border border-black/10">
                          VS
                        </span>
                      ) : (
                        <span className="font-black text-lg sm:text-xl px-3.5 py-1 rounded-xl border border-black/15 bg-black/25 shadow-inner">
                          {m.home_score} : {m.away_score}
                        </span>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className="flex items-center gap-3 justify-start">
                      {m.away_team?.logo_url ? (
                        <img
                          src={m.away_team.logo_url}
                          alt=""
                          className="w-10 h-10 rounded-xl object-contain shrink-0 p-1 bg-black/10 border border-black/10 shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 bg-black/20 shadow-sm">
                          {m.away_team?.name?.charAt(0) || 'A'}
                        </div>
                      )}
                      <span
                        style={{
                          color: m.away_team_id === teamId ? primaryColor : undefined,
                        }}
                        className={`text-base sm:text-lg text-left truncate ${
                          m.away_team_id === teamId ? 'font-black' : 'font-bold'
                        }`}
                      >
                        {m.away_team?.name || 'Away'}
                      </span>
                    </div>
                  </div>

                  {/* Basketball Box Score Button */}
                  {isBasketball && m.status !== 'scheduled' && (
                    <div className="pt-2 border-t border-black/10 flex justify-end">
                      <button
                        onClick={() => toggleBoxScore(m.id)}
                        style={{ borderColor: primaryColor }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-black/20 hover:bg-black/30 transition flex items-center gap-1.5"
                      >
                        📊 {isExpanded ? 'Hide Box Score' : 'Team Box Score'}
                      </button>
                    </div>
                  )}

                  {/* Basketball Box Score Table (Only for this team) */}
                  {isExpanded && isBasketball && (
                    <div className="pt-3 border-t border-black/10 space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider opacity-80">
                          🏀 {team.name} Stats
                        </span>
                      </div>

                      {loadingStats ? (
                        <div className="text-xs opacity-60 text-center py-4">Loading player stats...</div>
                      ) : currentMatchStats.length === 0 ? (
                        <div className="text-xs opacity-60 text-center py-4 bg-black/10 rounded-lg">
                          No box score stats recorded for {team.name} in this match.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-black/10 bg-black/20">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-black/30 text-white/70 font-semibold">
                              <tr>
                                <th className="p-2.5">Player</th>
                                <th className="p-2.5 text-center">PTS</th>
                                <th className="p-2.5 text-center">REB</th>
                                <th className="p-2.5 text-center">AST</th>
                                <th className="p-2.5 text-center">STL</th>
                                <th className="p-2.5 text-center">BLK</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/10">
                              {currentMatchStats.map((stat) => (
                                <tr key={stat.id} className="hover:bg-black/10">
                                  <td className="p-2.5 font-bold">
                                    {stat.player?.number && (
                                      <span className="opacity-60 font-mono mr-1.5">
                                        #{stat.player.number}
                                      </span>
                                    )}
                                    {stat.player?.name || 'Unknown Player'}
                                  </td>
                                  <td className="p-2.5 text-center font-black text-amber-400">{stat.points}</td>
                                  <td className="p-2.5 text-center font-semibold">{stat.rebounds}</td>
                                  <td className="p-2.5 text-center font-semibold">{stat.assists}</td>
                                  <td className="p-2.5 text-center font-semibold">{stat.steals}</td>
                                  <td className="p-2.5 text-center font-semibold">{stat.blocks}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}