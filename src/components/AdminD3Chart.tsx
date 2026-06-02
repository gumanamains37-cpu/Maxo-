import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Sparkles, Users, Mic2, Coins, Calendar } from 'lucide-react';

export interface ChartDataPoint {
  day: number;
  dateStr: string;
  activeUsers: number;
  roomActivity: number;
  coinTransactions: number;
}

export default function AdminD3Chart() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Highlight states for each metric line
  const [activeMetric, setActiveMetric] = useState<'all' | 'users' | 'rooms' | 'coins'>('all');
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Generate gorgeous, highly realistic 30-day historical data with weekends cyclic spikes
  const chartData = useMemo(() => {
    const points: ChartDataPoint[] = [];
    const baseDate = new Date(2026, 4, 2); // Start early may 2026

    for (let i = 1; i <= 30; i++) {
      const currentDate = new Date(baseDate);
      currentDate.setDate(baseDate.getDate() + i);
      
      const dayOfWeek = currentDate.getDay(); // 0 is Sunday, 6 is Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Base metrics with organic noise and weekend surges
      const weekendMultiplier = isWeekend ? 1.45 : 1.0;
      const noise1 = Math.sin(i * 0.9) * 80;
      const noise2 = Math.cos(i * 0.7) * 15;
      const noise3 = Math.sin(i * 1.2) * 800;

      const activeUsers = Math.round((950 + noise1) * weekendMultiplier);
      const roomActivity = Math.round((70 + noise2) * weekendMultiplier);
      const coinTransactions = Math.round((5200 + noise3) * (isWeekend ? 1.6 : 1.0));

      const dateStr = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      points.push({
        day: i,
        dateStr,
        activeUsers,
        roomActivity,
        coinTransactions
      });
    }
    return points;
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Clear previous drawing contents
    const svgElement = d3.select(svgRef.current);
    svgElement.selectAll('*').remove();

    // Dynamically retrieve container widths to render beautifully on responsive devices
    const containerWidth = containerRef.current.getBoundingClientRect().width || 600;
    const height = 320;
    const margin = { top: 24, right: 30, bottom: 40, left: 55 };

    const width = containerWidth;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Apply primary sizing attributes directly
    svgElement
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('style', 'max-width: 100%; height: auto;');

    // Create container grouping translations
    const g = svgElement.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // 1. SCALES SETUP
    const xScale = d3.scalePoint()
      .domain(chartData.map(d => d.dateStr))
      .range([0, chartWidth]);

    const usersMax = d3.max(chartData, d => d.activeUsers) || 2000;
    const roomsMax = d3.max(chartData, d => d.roomActivity) || 200;
    const coinsMax = d3.max(chartData, d => d.coinTransactions) || 12000;

    // Y scale normalized standardizer map to make multiple scales read correctly in single coordinate space
    const yScaleAll = d3.scaleLinear()
      .domain([0, 100]) // Normalized to 0-100% heights
      .range([chartHeight, 0]);

    // Sub-scales for real calculations
    const yScaleUsers = d3.scaleLinear()
      .domain([0, usersMax * 1.1])
      .range([chartHeight, 0]);

    const yScaleRooms = d3.scaleLinear()
      .domain([0, roomsMax * 1.1])
      .range([chartHeight, 0]);

    const yScaleCoins = d3.scaleLinear()
      .domain([0, coinsMax * 1.1])
      .range([chartHeight, 0]);

    // 2. DEFINE GRADIENTS FOR MODERN NEON GLOWS
    const defs = svgElement.append('defs');

    // Users (Teal) Gradient
    const gradUsers = defs.append('linearGradient')
      .attr('id', 'grad-users')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    gradUsers.append('stop').attr('offset', '0%').attr('stop-color', '#10B981').attr('stop-opacity', 0.25);
    gradUsers.append('stop').attr('offset', '100%').attr('stop-color', '#10B981').attr('stop-opacity', 0.0);

    // Rooms (Pink) Gradient
    const gradRooms = defs.append('linearGradient')
      .attr('id', 'grad-rooms')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    gradRooms.append('stop').attr('offset', '0%').attr('stop-color', '#EC4899').attr('stop-opacity', 0.25);
    gradRooms.append('stop').attr('offset', '100%').attr('stop-color', '#EC4899').attr('stop-opacity', 0.0);

    // Coins (Gold) Gradient
    const gradCoins = defs.append('linearGradient')
      .attr('id', 'grad-coins')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    gradCoins.append('stop').attr('offset', '0%').attr('stop-color', '#F59E0B').attr('stop-opacity', 0.25);
    gradCoins.append('stop').attr('offset', '100%').attr('stop-color', '#F59E0B').attr('stop-opacity', 0.0);

    // Glowing subtle shadow filter
    const dropShadow = defs.append('filter')
      .attr('id', 'neon-shadow')
      .attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    dropShadow.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'blur');
    dropShadow.append('feMerge').selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter().append('feMergeNode')
      .attr('in', d => d);

    // 3. BACKGROUND GRID LINES
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.07)
      .call(d3.axisLeft(yScaleAll)
        .ticks(5)
        .tickSize(-chartWidth)
        .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#FFFFFF');

    // 4. AXES DRAWINGS
    const xAxis = d3.axisBottom(xScale)
      .tickValues(chartData.filter((_, idx) => idx % 4 === 0).map(d => d.dateStr));

    // Custom formatted bottom timeline axis
    const xAxisG = g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(xAxis);

    xAxisG.select('.domain').attr('stroke', 'rgba(255,255,255,0.1)');
    xAxisG.selectAll('line').attr('stroke', 'rgba(255,255,255,0.1)');
    xAxisG.selectAll('text')
      .attr('fill', '#94A3B8')
      .attr('font-size', '10px')
      .attr('font-family', 'Space Grotesk')
      .attr('dy', '10px');

    // Left primary axis matching active selections
    let primaryYScale = yScaleUsers;
    let formatTick = (v: any) => `${v}`;
    let strokeColor = '#10B981';

    if (activeMetric === 'rooms') {
      primaryYScale = yScaleRooms;
      strokeColor = '#EC4899';
    } else if (activeMetric === 'coins') {
      primaryYScale = yScaleCoins;
      formatTick = (v: any) => `${v / 1000}k`;
      strokeColor = '#F59E0B';
    } else if (activeMetric === 'all') {
      // In 'all' view, left axis matches Active Users metric scale
      primaryYScale = yScaleUsers;
      strokeColor = 'rgba(255,255,255,0.2)';
    }

    const yAxisAxis = d3.axisLeft(primaryYScale)
      .ticks(5)
      .tickFormat(formatTick);

    const yAxisG = g.append('g')
      .call(yAxisAxis);

    yAxisG.select('.domain').attr('stroke', 'rgba(255,255,255,0.1)');
    yAxisG.selectAll('line').attr('stroke', 'rgba(255,255,255,0.1)');
    yAxisG.selectAll('text')
      .attr('fill', '#94A3B8')
      .attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono');

    // Add metric Y axis descriptor label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -chartHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748B')
      .attr('font-size', '9px')
      .attr('font-family', 'Space Grotesk')
      .attr('class', 'uppercase tracking-wider')
      .text(activeMetric === 'all' ? 'Active Users (Left scale)' : activeMetric);

    // 5. GRAPH PIPELINE GENERATORS
    // Curve interpolation for fluid peaks
    const curveType = d3.curveMonotoneX;

    // ACTIVE USERS LINE & AREA
    const lineUsersGen = d3.line<ChartDataPoint>()
      .x(d => xScale(d.dateStr) || 0)
      .y(d => yScaleUsers(d.activeUsers))
      .curve(curveType);

    const areaUsersGen = d3.area<ChartDataPoint>()
      .x(d => xScale(d.dateStr) || 0)
      .y0(chartHeight)
      .y1(d => yScaleUsers(d.activeUsers))
      .curve(curveType);

    // DAILY ROOM ACTIVITY LINE & AREA
    const lineRoomsGen = d3.line<ChartDataPoint>()
      .x(d => xScale(d.dateStr) || 0)
      .y(d => yScaleRooms(d.roomActivity))
      .curve(curveType);

    const areaRoomsGen = d3.area<ChartDataPoint>()
      .x(d => xScale(d.dateStr) || 0)
      .y0(chartHeight)
      .y1(d => yScaleRooms(d.roomActivity))
      .curve(curveType);

    // COIN FLOW LINE & AREA
    const lineCoinsGen = d3.line<ChartDataPoint>()
      .x(d => xScale(d.dateStr) || 0)
      .y(d => yScaleCoins(d.coinTransactions))
      .curve(curveType);

    const areaCoinsGen = d3.area<ChartDataPoint>()
      .x(d => xScale(d.dateStr) || 0)
      .y0(chartHeight)
      .y1(d => yScaleCoins(d.coinTransactions))
      .curve(curveType);

    // 6. RENDER THE CHOSEN METRICS
    const usersActive = activeMetric === 'all' || activeMetric === 'users';
    const tvActive = activeMetric === 'all' || activeMetric === 'rooms';
    const coinsActive = activeMetric === 'all' || activeMetric === 'coins';

    // A. Fill Gradients
    if (usersActive) {
      g.append('path')
        .datum(chartData)
        .attr('class', 'area-users')
        .attr('d', areaUsersGen)
        .attr('fill', 'url(#grad-users)')
        .attr('opacity', activeMetric === 'all' ? 0.3 : 0.7);
    }

    if (tvActive) {
      g.append('path')
        .datum(chartData)
        .attr('class', 'area-rooms')
        .attr('d', areaRoomsGen)
        .attr('fill', 'url(#grad-rooms)')
        .attr('opacity', activeMetric === 'all' ? 0.2 : 0.6);
    }

    if (coinsActive) {
      g.append('path')
        .datum(chartData)
        .attr('class', 'area-coins')
        .attr('d', areaCoinsGen)
        .attr('fill', 'url(#grad-coins)')
        .attr('opacity', activeMetric === 'all' ? 0.15 : 0.5);
    }

    // B. Drawing Neon Border Strokes
    if (usersActive) {
      g.append('path')
        .datum(chartData)
        .attr('fill', 'none')
        .attr('stroke', '#10B981')
        .attr('stroke-width', activeMetric === 'users' ? 3.5 : 2.0)
        .attr('class', 'stroke-users')
        .attr('d', lineUsersGen)
        .attr('filter', activeMetric === 'users' ? 'url(#neon-shadow)' : 'none');
    }

    if (tvActive) {
      g.append('path')
        .datum(chartData)
        .attr('fill', 'none')
        .attr('stroke', '#EC4899')
        .attr('stroke-width', activeMetric === 'rooms' ? 3.5 : 2.0)
        .attr('class', 'stroke-rooms')
        .attr('d', lineRoomsGen)
        .attr('filter', activeMetric === 'rooms' ? 'url(#neon-shadow)' : 'none');
    }

    if (coinsActive) {
      g.append('path')
        .datum(chartData)
        .attr('fill', 'none')
        .attr('stroke', '#F59E0B')
        .attr('stroke-width', activeMetric === 'coins' ? 3.5 : 2.0)
        .attr('class', 'stroke-coins')
        .attr('d', lineCoinsGen)
        .attr('filter', activeMetric === 'coins' ? 'url(#neon-shadow)' : 'none');
    }

    // 7. INTERACTIVE TRACKING RULER GRID
    const mouseG = g.append('g').attr('class', 'mouse-over-effects');

    const trackingLine = mouseG.append('line')
      .attr('class', 'focus-line')
      .attr('stroke', 'rgba(255, 255, 255, 0.18)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3')
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .style('opacity', 0);

    // Circle indicators on tracking lines
    const indicatorUsers = mouseG.append('circle')
      .attr('r', 5)
      .attr('fill', '#10B981')
      .attr('stroke', '#09090B')
      .attr('stroke-width', 2)
      .style('opacity', 0);

    const indicatorRooms = mouseG.append('circle')
      .attr('r', 5)
      .attr('fill', '#EC4899')
      .attr('stroke', '#09090B')
      .attr('stroke-width', 2)
      .style('opacity', 0);

    const indicatorCoins = mouseG.append('circle')
      .attr('r', 5)
      .attr('fill', '#F59E0B')
      .attr('stroke', '#09090B')
      .attr('stroke-width', 2)
      .style('opacity', 0);

    // Overlay rect to capture pointer drag coordinates
    g.append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseover', () => {
        trackingLine.style('opacity', 1);
        if (usersActive) indicatorUsers.style('opacity', 1);
        if (tvActive) indicatorRooms.style('opacity', 1);
        if (coinsActive) indicatorCoins.style('opacity', 1);
      })
      .on('mouseout', () => {
        trackingLine.style('opacity', 0);
        indicatorUsers.style('opacity', 0);
        indicatorRooms.style('opacity', 0);
        indicatorCoins.style('opacity', 0);
        setHoveredPoint(null);
      })
      .on('mousemove', function (event) {
        const mouseCoords = d3.pointer(event);
        const mouseX = mouseCoords[0];

        // Solve approximate x coordinate back mapping to nearest point
        const domain = xScale.domain();
        const range = xScale.range();
        const rangePoints = xScale.domain().map(d => xScale(d) || 0);

        // Find binary indexing nearest point
        const nearestIndex = d3.bisectCenter(rangePoints, mouseX);
        const selectedDate = domain[nearestIndex];
        const point = chartData.find(d => d.dateStr === selectedDate);

        if (point) {
          const px = xScale(selectedDate) || 0;
          trackingLine.attr('x1', px).attr('x2', px);

          if (usersActive) {
            indicatorUsers.attr('cx', px).attr('cy', yScaleUsers(point.activeUsers));
          }
          if (tvActive) {
            indicatorRooms.attr('cx', px).attr('cy', yScaleRooms(point.roomActivity));
          }
          if (coinsActive) {
            indicatorCoins.attr('cx', px).attr('cy', yScaleCoins(point.coinTransactions));
          }

          setHoveredPoint(point);
          
          // Tooltip screen layout coordinate offset
          setTooltipPos({
            x: px + margin.left + 20,
            y: mouseCoords[1] - 40
          });
        }
      });

  }, [chartData, activeMetric]);

  return (
    <div className="flex flex-col gap-4">
      {/* Interactive Quick Metric Switcher Filter Bar */}
      <div className="flex items-center justify-between bg-glass/45 backdrop-blur-md p-2 rounded-2xl border border-white/5 flex-wrap gap-2">
        <div className="text-xs font-semibold text-gray-400 flex items-center gap-1 px-2">
          <Calendar size={13} className="text-slate-400" />
          <span>Last 30 Days Telemetry:</span>
        </div>
        
        <div className="flex gap-1">
          <button
            onClick={() => setActiveMetric('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              activeMetric === 'all' 
                ? 'bg-white text-bg-dark font-extrabold shadow-sm' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            All
          </button>
          
          <button
            onClick={() => setActiveMetric('users')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 ${
              activeMetric === 'users' 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users size={12} />
            <span>Users</span>
          </button>

          <button
            onClick={() => setActiveMetric('rooms')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 ${
              activeMetric === 'rooms' 
                ? 'bg-pink-500/15 text-pink-400 border border-pink-500/20' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mic2 size={12} />
            <span>Rooms</span>
          </button>

          <button
            onClick={() => setActiveMetric('coins')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 ${
              activeMetric === 'coins' 
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Coins size={12} />
            <span>Coins</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div 
        ref={containerRef} 
        className="glass-card p-4 relative overflow-hidden bg-[#0F121E]/60 border border-white/5 flex flex-col justify-center select-none"
      >
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-pink-400 animate-pulse" />
            <span className="text-[11px] font-black tracking-widest text-white/90 uppercase font-display italic">Lounge Sync Telemetry</span>
          </div>
          <div className="flex gap-4 text-[9px] text-gray-500 font-bold uppercase font-mono">
            <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active Users</div>
            <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-pink-500" /> Rooms Online</div>
            <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Coin Flow</div>
          </div>
        </div>

        <svg ref={svgRef} className="overflow-visible block w-full" />

        {/* Dynamic HTML Tooltip overlay */}
        {hoveredPoint && tooltipPos && (
          <div 
            className="absolute z-10 p-3 rounded-xl bg-bg-dark/95 border border-white/10 shadow-2xl backdrop-blur-md pointer-events-none flex flex-col gap-1 text-[11px] font-sans w-36 transition-all duration-100 ease-out"
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y}px`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="font-extrabold text-white pb-1 border-b border-white/5 mb-1 text-[10px] tracking-wider uppercase font-display">
              {hoveredPoint.dateStr}
            </div>
            
            <div className="flex items-center justify-between font-mono">
              <span className="text-gray-400">Users:</span>
              <span className="text-emerald-400 font-extrabold">{hoveredPoint.activeUsers.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between font-mono">
              <span className="text-gray-400">Rooms:</span>
              <span className="text-pink-400 font-extrabold">{hoveredPoint.roomActivity}</span>
            </div>

            <div className="flex items-center justify-between font-mono">
              <span className="text-gray-400">Coins:</span>
              <span className="text-amber-400 font-extrabold">{hoveredPoint.coinTransactions.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
