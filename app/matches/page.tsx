'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

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
}

interface Match {
  id: string;
  league_id: string;
  round?: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  status: 'scheduled' | 'live' | 'finished';
  home_score: number;
  away_score: number;
  home_team?: { id: string; name: string; logo_url?: string };
  away_team?: { id: string; name: string; logo_url?: string };
  leagues?: { id: string; name: string; sport: string; logo_url?: string };
}

interface StandingRow {
  teamId: string;
  teamName: string;
  logoUrl?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  pf: number;
  pa: number;
  diff: number;
  points: number;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueTeams, setLeagueTeams] = useState<{ league_id: string; team_id: string; teams: Team }[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Filter & Tab States
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('all');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'matches' | 'standings'>('matches');

  const fetchData = async () => {
    const [{ data: matchData }, { data: leagueData }, { data: ltData }] = await Promise.all([
      supabase
        .from('matches')
        .select(`
          id,
          league_id,
          round,
          home_team_id,
          away_team_id,
          match_date,
          status,
          home_score,
          away_score,
          home_team:teams!matches_home_team_id_fkey(id, name, logo_url),
          away_team:teams!matches_away_team_id_fkey(id, name, logo_url),
          leagues(id, name, sport, logo_url)
        `)
        .order('match_date', { ascending: true }),
      supabase.from('leagues').select('*').order('created_at', { ascending: false }),
      supabase.from('league_teams').select('league_id, team_id, teams(id, name, logo_url)'),
    ]);

    if (matchData) setMatches(matchData as unknown as Match[]);
    if (leagueData) setLeagues(leagueData);
    if (ltData) setLeagueTeams(ltData as unknown as { league_id: string; team_id: string; teams: Team }[]);
    setLoading(false);
  };

  useEffect(() => {
    setMounted(true);
    fetchData();

    const params = new URLSearchParams(window.location.search);
    const urlLeagueId = params.get('leagueId');
    const urlTeamId = params.get('teamId');
    const urlTab = params.get('tab');

    if (urlLeagueId) setSelectedLeagueId(urlLeagueId);
    if (urlTeamId) setSelectedTeamId(urlTeamId);
    if (urlTab === 'standings' || urlTab === 'matches') {
      setActiveTab(urlTab);
    }

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
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Διαθέσιμες ομάδες για το dropdown ανάλογα με την επιλεγμένη λίγκα
  const availableTeams = useMemo(() => {
    const filtered =
      selectedLeagueId === 'all'
        ? leagueTeams
        : leagueTeams.filter((lt) => lt.league_id === selectedLeagueId);

    const map = new Map<string, Team>();
    filtered.forEach((lt) => {
      if (lt.teams) map.set(lt.teams.id, lt.teams);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [leagueTeams, selectedLeagueId]);

  // Φιλτραρισμένοι αγώνες
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (selectedLeagueId !== 'all' && m.league_id !== selectedLeagueId) return false;
      if (
        selectedTeamId !== 'all' &&
        m.home_team_id !== selectedTeamId &&
        m.away_team_id !== selectedTeamId
      ) {
        return false;
      }
      return true;
    });
  }, [matches, selectedLeagueId, selectedTeamId]);

  // Υπολογισμός Βαθμολογίας (League Table)
  const standings = useMemo(() => {
    const activeLeague = leagues.find((l) => l.id === selectedLeagueId) || leagues[0];
    if (!activeLeague) return [];

    const isBasketball = activeLeague.sport?.toLowerCase() === 'basketball';
    const teamsInLeague = leagueTeams
      .filter((lt) => lt.league_id === activeLeague.id && lt.teams)
      .map((lt) => lt.teams);

    const tableMap = new Map<string, StandingRow>();
    teamsInLeague.forEach((t) => {
      tableMap.set(t.id, {
        teamId: t.id,
        teamName: t.name,
        logoUrl: t.logo_url,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        pf: 0,
        pa: 0,
        diff: 0,
        points: 0,
      });
    });

    matches
      .filter((m) => m.league_id === activeLeague.id && m.status === 'finished')
      .forEach((m) => {
        const home = tableMap.get(m.home_team_id);
        const away = tableMap.get(m.away_team_id);
        if (!home || !away) return;

        home.played += 1;
        away.played += 1;
        home.pf += m.home_score;
        home.pa += m.away_score;
        away.pf += m.away_score;
        away.pa += m.home_score;

        if (m.home_score > m.away_score) {
          home.wins += 1;
          away.losses += 1;
          home.points += isBasketball ? 2 : 3;
          away.points += isBasketball ? 1 : 0;
        } else if (m.away_score > m.home_score) {
          away.wins += 1;
          home.losses += 1;
          away.points += isBasketball ? 2 : 3;
          home.points += isBasketball ? 1 : 0;
        } else {
          home.draws += 1;
          away.draws += 1;
          home.points += 1;
          away.points += 1;
        }
      });

    return Array.from(tableMap.values())
      .map((row) => ({ ...row, diff: row.pf - row.pa }))
      .sort((a, b) => b.points - a.points || b.diff - a.diff || b.pf - a.pf);
  }, [leagues, leagueTeams, matches, selectedLeagueId]);

  const currentStandingLeague = leagues.find((l) => l.id === selectedLeagueId) || leagues[0];
  const isBasketballTable = currentStandingLeague?.sport?.toLowerCase() === 'basketball';

  return (
    <div className="min-h-screen bg-[#090d16] text-white py-10 px-4 sm:px-6">
      <main className="max-w-4xl mx-auto space-y-6">
        {/* Top Bar: Back + Filters + Tabs */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg border border-slate-700 font-medium"
            >
              ← Admin Dashboard
            </Link>

            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('matches')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  activeTab === 'matches'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📅 Matches
              </button>
              <button
                onClick={() => setActiveTab('standings')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  activeTab === 'standings'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📊 League Table
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">League</label>
              <select
                value={selectedLeagueId}
                onChange={(e) => {
                  setSelectedLeagueId(e.target.value);
                  setSelectedTeamId('all');
                }}
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="all">All Leagues</option>
                {leagues.map((lg) => (
                  <option key={lg.id} value={lg.id}>
                    {lg.name} ({lg.season})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Team Filter</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="all">All Teams</option>
                {availableTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500 font-mono text-sm animate-pulse">
            Loading...
          </div>
        ) : activeTab === 'standings' ? (
          /* LEAGUE TABLE VIEW */
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {currentStandingLeague?.logo_url ? (
                  <img
                    src={currentStandingLeague.logo_url}
                    alt=""
                    className="w-6 h-6 object-contain rounded bg-slate-800 p-0.5"
                  />
                ) : (
                  <span>🏆</span>
                )}
                <h2 className="font-bold text-base">
                  {currentStandingLeague?.name || 'League'} — Standings
                </h2>
              </div>
              <span className="text-xs text-slate-400">{currentStandingLeague?.season}</span>
            </div>

            {standings.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No teams found for this league.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px]">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">Team</th>
                      <th className="p-3 text-center">GP</th>
                      <th className="p-3 text-center">W</th>
                      {!isBasketballTable && <th className="p-3 text-center">D</th>}
                      <th className="p-3 text-center">L</th>
                      <th className="p-3 text-center">{isBasketballTable ? 'PF' : 'GF'}</th>
                      <th className="p-3 text-center">{isBasketballTable ? 'PA' : 'GA'}</th>
                      <th className="p-3 text-center">+/-</th>
                      <th className="p-3 text-center font-bold text-white">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {standings.map((row, idx) => {
                      const isHighlighted = selectedTeamId !== 'all' && row.teamId === selectedTeamId;
                      return (
                        <tr
                          key={row.teamId}
                          className={`transition ${
                            isHighlighted
                              ? 'bg-cyan-950/50 text-cyan-200'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-3 text-center font-mono font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="p-3">
                            <Link
                              href={`/teams/${row.teamId}`}
                              className="flex items-center gap-2.5 font-semibold hover:text-cyan-400"
                            >
                              {row.logoUrl ? (
                                <img
                                  src={row.logoUrl}
                                  alt=""
                                  className="w-6 h-6 object-contain rounded bg-slate-800 p-0.5 shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {row.teamName.charAt(0)}
                                </div>
                              )}
                              <span>{row.teamName}</span>
                            </Link>
                          </td>
                          <td className="p-3 text-center font-mono">{row.played}</td>
                          <td className="p-3 text-center font-mono text-emerald-400">{row.wins}</td>
                          {!isBasketballTable && (
                            <td className="p-3 text-center font-mono text-slate-400">{row.draws}</td>
                          )}
                          <td className="p-3 text-center font-mono text-rose-400">{row.losses}</td>
                          <td className="p-3 text-center font-mono text-slate-300">{row.pf}</td>
                          <td className="p-3 text-center font-mono text-slate-300">{row.pa}</td>
                          <td className="p-3 text-center font-mono">
                            {row.diff > 0 ? `+${row.diff}` : row.diff}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-sm text-amber-400">
                            {row.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="text-center py-20 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-500 text-sm">
            No matches found for the selected filters.
          </div>
        ) : (
          /* MATCHES LIST VIEW */
          <div className="space-y-3">
            {filteredMatches.map((m) => {
              const homeWon = m.status === 'finished' && m.home_score > m.away_score;
              const awayWon = m.status === 'finished' && m.away_score > m.home_score;

              const timeStr = mounted
                ? new Date(m.match_date).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              const dateStr = mounted
                ? new Date(m.match_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : '';

              return (
                <div
                  key={m.id}
                  className="group relative rounded-xl bg-[#0f172a] border border-slate-800 hover:border-slate-700 transition p-4 shadow-sm"
                >
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

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div className="flex items-center gap-3 justify-end">
                      <Link
                        href={`/teams/${m.home_team_id}`}
                        className={`text-sm sm:text-base text-right truncate hover:underline ${
                          homeWon
                            ? 'font-bold text-white'
                            : m.status === 'finished'
                            ? 'text-slate-400 font-medium'
                            : 'text-slate-200 font-medium'
                        }`}
                      >
                        {m.home_team?.name || 'Home'}
                      </Link>
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
                      <Link
                        href={`/teams/${m.away_team_id}`}
                        className={`text-sm sm:text-base text-left truncate hover:underline ${
                          awayWon
                            ? 'font-bold text-white'
                            : m.status === 'finished'
                            ? 'text-slate-400 font-medium'
                            : 'text-slate-200 font-medium'
                        }`}
                      >
                        {m.away_team?.name || 'Away'}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}