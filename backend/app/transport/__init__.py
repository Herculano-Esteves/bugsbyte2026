"""
Transport routing package — multi-modal pathfinding over Portuguese GTFS data.

Architecture (bottom → top):
    connection  — DB access
    models      — data classes
    geo         — spatial index & transfer discovery
    schedule    — timetable queries
    router      — Dijkstra search engine
"""
