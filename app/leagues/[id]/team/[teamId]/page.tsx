'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../../lib/supabase';

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

interface Match {
  id: string;
  league_id: string;
  status: 'scheduled' | 'live' | 'finished';
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
}

interface TeamStanding {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export default function CustomizedTeamLeagueTablePage() {
  const params = useParams();
  const router = useRouter();
  const currentLeagueId = params.id as string;
  const currentTeamId = params.teamId as string;

  const [league, setLeague] = useState<League | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [loading, setLoading] = useState(true);

  // Πρωταθλήματα στα οποία έχει αγωνιστεί η συγκεκριμένη ομάδα
  const [teamPlayedLeagues, setTeamPlayedLeagues] = useState<League[]>([]);

  const fetchLeagueData = useCallback(async () => {
    if (!currentLeagueId || !currentTeamId) return;

    // 1. Φόρτωση Στοιχείων Επιλεγμένης Ομάδας
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', currentTeamId)
      .single();

    if (teamData) setSelectedTeam(teamData as Team);

    // 2. Εύρεση όλων των πρωταθλημάτων στα οποία έχει συμμετάσχει η ομάδα αυτή (μέσω του league_teams)
    const { data: teamLeaguesMap } = await supabase
      .from('league_teams')
      .select('league_id')
      .eq('team_id', currentTeamId);

    if (teamLeaguesMap && teamLeaguesMap.length > 0) {
      const leagueIds = teamLeaguesMap.map((tl) => tl.league_id);
      const { data: leaguesData } = await supabase
        .from('leagues')
        .select('*')
        .in('id', leagueIds)
        .order('season', { ascending: false });

      if (leaguesData) setTeamPlayedLeagues(leaguesData as League[]);
    }

    // 3. Φόρτωση Τρέχοντος Πρωταθλήματος
    const { data: leagueData, error: leagueError } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', currentLeagueId)
      .single();

    if (leagueError || !leagueData) {
      setLoading(false);
      return;
    }
    setLeague(leagueData as League);

    // 4. Φόρτωση Ομάδων του Τρέχοντος Πρωταθλήματος
    const { data: ltData } = await supabase
      .from('league_teams')
      .select('team_id')
      .eq('league_id', currentLeagueId);

    let leagueTeams: Team[] = [];
    if (ltData && ltData.length > 0) {
      const teamIds = ltData.map((item) => item.team_id);
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds);

      if (teamsData) leagueTeams = teamsData as Team[];
    }

    // 5. Φόρτωση Αγώνων
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .eq('league_id', currentLeagueId);

    const matches = (matchesData as Match[]) || [];
    const isBasketball = leagueData.sport?.toLowerCase() === 'basketball';

    // 6. Υπολογισμός Βαθμολογίας
    const statsMap: Record<string, TeamStanding> = {};

    leagueTeams.forEach((t) => {
      statsMap[t.id] = {
        team: t,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
    });

    matches.forEach((m) => {
      if (m.status !== 'finished') return;

      const home = statsMap[m.home_team_id];
      const away = statsMap[m.away_team_id];

      if (home) {
        home.played += 1;
        home.goalsFor += m.home_score;
        home.goalsAgainst += m.away_score;
      }

      if (away) {
        away.played += 1;
        away.goalsFor += m.away_score;
        away.goalsAgainst += m.home_score;
      }

      if (m.home_score > m.away_score) {
        if (home) {
          home.won += 1;
          home.points += isBasketball ? 2 : 3;
        }
        if (away) {
          away.lost += 1;
          if (isBasketball) away.points += 1;
        }
      } else if (m.home_score < m.away_score) {
        if (away) {
          away.won += 1;
          away.points += isBasketball ? 2 : 3;
        }
        if (home) {
          home.lost += 1;
          if (isBasketball) home.points += 1;
        }
      } else {
        if (home) {
          home.drawn += 1;
          home.points += 1;
        }
        if (away) {
          away.drawn += 1;
          away.points += 1;
        }
      }
    });

    const computedStandings = Object.values(statsMap).map((st) => ({
      ...st,
      goalDifference: st.goalsFor - st.goalsAgainst,
    }));

    computedStandings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    setStandings(computedStandings);
    setLoading(false);
  }, [currentLeagueId, currentTeamId]);

  useEffect(() => {
    fetchLeagueData();
  }, [currentLeagueId, currentTeamId, fetchLeagueData]);

  // Αλλαγή Πρωταθλήματος από το Dropdown
  const handleLeagueChange = (newLeagueId: string) => {
    router.push(`/leagues/${newLeagueId}/team/${currentTeamId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-400 flex items-center justify-center text-sm">
        Loading customized league standings...
      </div>
    );
  }

  if (!league || !selectedTeam) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-300 flex flex-col items-center justify-center space-y-4">
        <p className="text-lg">League or Team not found.</p>
        <Link href="/matches" className="text-cyan-400 hover:underline text-sm">
          ← Back to matches
        </Link>
      </div>
    );
  }

  const isLight = selectedTeam.theme_mode === 'light';
  const primaryColor = selectedTeam.primary_color || '#0284c7';
  const secondaryColor = selectedTeam.secondary_color || (isLight ? '#ffffff' : '#0f172a');
  const pageBgColor = selectedTeam.bg_color || (isLight ? '#f8fafc' : '#090d16');
  const fontColor = selectedTeam.text_color || (isLight ? '#0f172a' : '#ffffff');
  const isBasketball = league.sport?.toLowerCase() === 'basketball';

  return (
    <div
      style={{ backgroundColor: pageBgColor, color: fontColor }}
      className="min-h-screen py-10 px-4 sm:px-6 transition-colors duration-300"
    >
      <main className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex justify-between items-center text-xs opacity-80 font-medium">
          <Link href={`/teams/${selectedTeam.id}`} className="hover:opacity-100 transition">
            ← Back to {selectedTeam.name} Page
          </Link>
          <Link href="/" className="hover:opacity-100 transition">
            Admin Panel
          </Link>
        </div>

        {/* Dropdown Section: Leagues Played by Team */}
        <div
          style={{ backgroundColor: secondaryColor, borderColor: primaryColor }}
          className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 shadow-lg"
        >
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-xs font-bold uppercase opacity-80 shrink-0">
              🏆 {selectedTeam.name}'s Leagues:
            </label>
            <div className="relative flex-1 sm:w-80">
              <select
                value={currentLeagueId}
                onChange={(e) => handleLeagueChange(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-black/30 border border-black/20 text-xs font-bold focus:outline-none cursor-pointer appearance-none pr-8"
              >
                {teamPlayedLeagues.map((lg) => (
                  <option key={lg.id} value={lg.id} className="bg-slate-900 text-white p-2">
                    {lg.name} — {lg.season} ({lg.sport.toUpperCase()})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-xs opacity-70">
                ▼
              </div>
            </div>
          </div>

          <div className="text-xs font-semibold opacity-75">
            Showing table for: <strong style={{ color: primaryColor }}>{league.name} ({league.season})</strong>
          </div>
        </div>

        {/* Customized Header Banner with Team Colors & Current League Logo */}
        <div
          style={{ backgroundColor: secondaryColor, borderColor: primaryColor }}
          className="p-6 sm:p-8 rounded-2xl border-2 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-5 text-center sm:text-left">
            {selectedTeam.logo_url ? (
              <img
                src={selectedTeam.logo_url}
                alt={selectedTeam.name}
                className="w-16 h-16 rounded-2xl object-contain p-2 border bg-black/10 border-black/20 shadow-md shrink-0"
              />
            ) : (
              <div
                style={{ backgroundColor: primaryColor }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg shrink-0"
              >
                {selectedTeam.name.charAt(0)}
              </div>
            )}

            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold uppercase tracking-wider opacity-80">
                <span>{league.name} Standings</span>
                <span style={{ color: primaryColor }}>● {selectedTeam.name} View</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black mt-1">{league.name} Table</h1>
              <p className="text-xs opacity-75 font-medium mt-0.5">
                Season {league.season} ({league.sport.toUpperCase()})
              </p>
            </div>
          </div>

          {league.logo_url && (
            <div className="flex items-center gap-2 bg-black/10 p-2 rounded-xl border border-black/10 shrink-0">
              <img
                src={league.logo_url}
                alt={league.name}
                className="w-10 h-10 object-contain"
              />
              <span className="text-xs font-bold pr-1">{league.name}</span>
            </div>
          )}
        </div>

        {/* Standings Table in Team Colors */}
        <div
          style={{ backgroundColor: secondaryColor }}
          className="rounded-2xl border border-black/10 overflow-hidden shadow-2xl"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/25 text-xs uppercase tracking-wider font-bold border-b border-black/10">
                <tr>
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4">Team</th>
                  <th className="p-4 text-center">P</th>
                  <th className="p-4 text-center">W</th>
                  {!isBasketball && <th className="p-4 text-center">D</th>}
                  <th className="p-4 text-center">L</th>
                  <th className="p-4 text-center">{isBasketball ? 'PF' : 'GF'}</th>
                  <th className="p-4 text-center">{isBasketball ? 'PA' : 'GA'}</th>
                  <th className="p-4 text-center">DIFF</th>
                  <th className="p-4 text-center font-black">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 font-medium">
                {standings.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 opacity-60 text-xs italic">
                      No teams registered in this league yet.
                    </td>
                  </tr>
                ) : (
                  standings.map((st, idx) => {
                    const isSelectedTeamRow = st.team.id === currentTeamId;

                    return (
                      <tr
                        key={st.team.id}
                        style={{
                          backgroundColor: isSelectedTeamRow ? `${primaryColor}25` : undefined,
                          borderColor: isSelectedTeamRow ? primaryColor : undefined,
                        }}
                        className={`transition ${
                          isSelectedTeamRow ? 'font-black border-l-4' : 'hover:bg-black/10'
                        }`}
                      >
                        <td className="p-4 text-center font-bold text-xs opacity-70">
                          {idx + 1}
                        </td>
                        <td className="p-4">
                          <Link
                            href={`/teams/${st.team.id}`}
                            className="flex items-center gap-3 font-bold hover:underline transition"
                          >
                            {st.team.logo_url ? (
                              <img
                                src={st.team.logo_url}
                                alt=""
                                className="w-7 h-7 object-contain rounded-md bg-black/10 p-0.5 border border-black/10 shrink-0"
                              />
                            ) : (
                              <div
                                style={{ backgroundColor: st.team.primary_color || primaryColor }}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                              >
                                {st.team.name.charAt(0)}
                              </div>
                            )}
                            <span className="truncate">
                              {st.team.name}
                              {isSelectedTeamRow && (
                                <span
                                  style={{ backgroundColor: primaryColor }}
                                  className="ml-2 text-[10px] text-white px-1.5 py-0.5 rounded uppercase font-bold"
                                >
                                  YOU
                                </span>
                              )}
                            </span>
                          </Link>
                        </td>
                        <td className="p-4 text-center opacity-90">{st.played}</td>
                        <td className="p-4 text-center text-emerald-500 font-bold">{st.won}</td>
                        {!isBasketball && (
                          <td className="p-4 text-center text-amber-500 font-bold">{st.drawn}</td>
                        )}
                        <td className="p-4 text-center text-rose-500 font-bold">{st.lost}</td>
                        <td className="p-4 text-center opacity-75">{st.goalsFor}</td>
                        <td className="p-4 text-center opacity-75">{st.goalsAgainst}</td>
                        <td className="p-4 text-center font-mono text-xs opacity-90">
                          {st.goalDifference > 0 ? `+${st.goalDifference}` : st.goalDifference}
                        </td>
                        <td
                          style={{ color: isSelectedTeamRow ? primaryColor : fontColor }}
                          className="p-4 text-center font-black text-base bg-black/15"
                        >
                          {st.points}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}