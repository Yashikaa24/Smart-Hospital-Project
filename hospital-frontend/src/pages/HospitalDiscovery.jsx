import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Bed, Activity, ArrowRight, Navigation, Clock, ShieldAlert, Star, Phone, ExternalLink } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const HospitalDiscovery = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [userLocation, setUserLocation] = useState([22.7196, 75.8577]); // Default: Indore
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [mapZoom, setMapZoom] = useState(12);

  // Map settings and sync states
  const [searchAsMove, setSearchAsMove] = useState(true);
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);

  // Refs to maintain references and avoid stale closures
  const mapRef = useRef(null);
  const googleMap = useRef(null);
  const markersRef = useRef({});
  const infoWindowRef = useRef(null);
  const userMarkerRef = useRef(null);
  const searchAsMoveRef = useRef(searchAsMove);
  const isProgrammaticPan = useRef(false);
  const lastSearchLocation = useRef({ lat: 22.7196, lng: 75.8577 });
  const userLocationRef = useRef(userLocation);
  const hospitalsRef = useRef(hospitals);

  // Helper function to calculate distance in km
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  };

  // Sync ref values to avoid closure capture issues
  useEffect(() => {
    searchAsMoveRef.current = searchAsMove;
  }, [searchAsMove]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    hospitalsRef.current = hospitals;
  }, [hospitals]);

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = [pos.coords.latitude, pos.coords.longitude];
          isProgrammaticPan.current = true;
          setUserLocation(loc);
          if (googleMap.current) {
            googleMap.current.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            googleMap.current.setZoom(13);
          }
        },
        (err) => {
          console.warn("Location access denied or timed out", err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const loadHospitals = async (loc = null) => {
    try {
      const lat = loc ? loc[0] : userLocation[0];
      const lng = loc ? loc[1] : userLocation[1];
      
      lastSearchLocation.current = { lat, lng };

      const response = await axios.get(`${API_URL}/hospitals/?lat=${lat}&lng=${lng}`);
      
      const mapped = response.data.map(h => ({
        id: h.id,
        name: h.name,
        address: h.address || 'Unknown address',
        phone: h.phone || 'N/A',
        distance: h.distance || '1.2 km',
        beds: h.available_beds,
        icu: h.icu_beds,
        est_wait_time: h.est_wait_time,
        status: h.status || 'Open',
        crowd_level: h.crowd_level || 'Low',
        rating: (4.0 + Math.random() * 0.9).toFixed(1),
        coords: { lat: h.latitude || 22.7196, lng: h.longitude || 75.8577 }
      }));
      setHospitals(mapped);
      
      // Auto pan/zoom to the first result on initial load
      if (!loc && mapped.length > 0 && googleMap.current) {
        isProgrammaticPan.current = true;
        googleMap.current.panTo(mapped[0].coords);
        googleMap.current.setZoom(12);
      }
    } catch (error) {
      console.error("Could not load hospitals from backend", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    requestLocation();
    loadHospitals();
  }, []);

  // Reload when user coordinates change (Sync Location)
  useEffect(() => {
    loadHospitals(userLocation);
  }, [userLocation[0], userLocation[1]]);

  // Initialize Google Maps script and instance once
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      if (window.google && window.google.maps) {
        initMap();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      document.head.appendChild(script);
    };

    loadGoogleMapsScript();

    return () => {
      // Clean up markers
      if (markersRef.current) {
        Object.values(markersRef.current).forEach(m => m.setMap(null));
        markersRef.current = {};
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
    };
  }, []);

  // Synchronize markers on the map when the hospitals list changes
  useEffect(() => {
    if (!googleMap.current || !window.google || !window.google.maps) return;

    const map = googleMap.current;

    // Update user marker position
    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition({ lat: userLocation[0], lng: userLocation[1] });
    }

    // Remove old markers
    const newHospitalIds = new Set(hospitals.map(h => h.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!newHospitalIds.has(parseInt(id))) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    });

    // Add new markers or update positions
    hospitals.forEach(h => {
      if (markersRef.current[h.id]) {
        markersRef.current[h.id].setPosition(h.coords);
      } else {
        const marker = new window.google.maps.Marker({
          position: h.coords,
          map: map,
          title: h.name,
          animation: window.google.maps.Animation.DROP,
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
            scaledSize: new window.google.maps.Size(32, 32)
          }
        });

        marker.addListener('click', () => {
          handleSelectHospital(h, false);
        });

        markersRef.current[h.id] = marker;
      }
    });
  }, [hospitals]);

  const initMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: userLocationRef.current[0], lng: userLocationRef.current[1] },
      zoom: mapZoom,
      mapId: "DEMO_MAP_ID",
      mapTypeControlOptions: {
        position: window.google.maps.ControlPosition.TOP_LEFT
      },
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        {
          "featureType": "administrative",
          "elementType": "geometry",
          "stylers": [{ "visibility": "off" }]
        },
        {
          "featureType": "poi",
          "stylers": [{ "visibility": "off" }]
        },
        {
          "featureType": "road",
          "elementType": "labels.icon",
          "stylers": [{ "visibility": "off" }]
        }
      ]
    });

    googleMap.current = map;
    infoWindowRef.current = new window.google.maps.InfoWindow();

    // Create User Location Marker
    userMarkerRef.current = new window.google.maps.Marker({
      position: { lat: userLocationRef.current[0], lng: userLocationRef.current[1] },
      map: map,
      title: "Your Location",
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#0284c7",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      }
    });

    // Populate initial markers
    hospitalsRef.current.forEach(h => {
      if (!markersRef.current[h.id]) {
        const marker = new window.google.maps.Marker({
          position: h.coords,
          map: map,
          title: h.name,
          animation: window.google.maps.Animation.DROP,
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
            scaledSize: new window.google.maps.Size(32, 32)
          }
        });

        marker.addListener('click', () => {
          handleSelectHospital(h, false);
        });

        markersRef.current[h.id] = marker;
      }
    });

    // Add drag end / movement listener
    map.addListener('idle', () => {
      if (isProgrammaticPan.current) {
        isProgrammaticPan.current = false;
        return;
      }

      const center = map.getCenter();
      const lat = center.lat();
      const lng = center.lng();

      const distance = getDistance(lat, lng, lastSearchLocation.current.lat, lastSearchLocation.current.lng);

      // Trigger area search if panned more than 300 meters
      if (distance > 0.3) {
        if (searchAsMoveRef.current) {
          setUserLocation([lat, lng]);
        } else {
          setShowSearchThisArea(true);
        }
      }
    });
  };

  const handleSelectHospital = (h, recenterMap = true) => {
    setSelectedHospitalId(h.id);
    
    const marker = markersRef.current[h.id];
    if (marker && googleMap.current) {
      if (recenterMap) {
        isProgrammaticPan.current = true;
        googleMap.current.panTo(h.coords);
        googleMap.current.setZoom(14);
      }
      
      marker.setAnimation(window.google.maps.Animation.BOUNCE);
      setTimeout(() => marker.setAnimation(null), 1400);

      const crowd = getCrowdDetails(h.crowd_level);
      const contentString = `
        <div style="font-family: sans-serif; padding: 8px; max-width: 200px;">
          <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: bold; color: #0f172a;">${h.name}</h4>
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b;">${h.address}</p>
          <div style="font-size: 11px; margin-bottom: 8px; border-top: 1px solid #f1f5f9; padding-top: 6px;">
            <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
              <span>Beds Free:</span> <span style="font-weight:bold; color:#0d9488;">${h.beds}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
              <span>Wait Time:</span> <span style="font-weight:bold; color:#0284c7;">${h.est_wait_time} min</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>Crowd:</span> <span style="font-weight:bold;">${crowd.text}</span>
            </div>
          </div>
          <button id="infowindow-btn-${h.id}" style="width:100%; border:none; background:#0284c7; color:#fff; font-weight:bold; padding: 6px; border-radius:6px; font-size:11px; cursor:pointer;">
            Explore Details
          </button>
        </div>
      `;

      infoWindowRef.current.setContent(contentString);
      infoWindowRef.current.open(googleMap.current, marker);

      window.google.maps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
        const btn = document.getElementById(`infowindow-btn-${h.id}`);
        if (btn) {
          btn.onclick = () => navigate(`/hospital/${h.id}`);
        }
      });
    }

    const element = document.getElementById(`hosp-card-${h.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const getCrowdDetails = (level) => {
    switch (level) {
      case 'Low':
        return { text: 'Low Crowd', color: 'text-green-600 bg-green-50 border-green-200', badge: '🟢' };
      case 'Moderate':
        return { text: 'Moderate Crowd', color: 'text-amber-600 bg-amber-50 border-amber-200', badge: '🟡' };
      case 'Heavy':
      default:
        return { text: 'Heavy Crowd', color: 'text-red-600 bg-red-50 border-red-200', badge: '🔴' };
    }
  };

  const filteredHospitals = hospitals.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header section with Clean Medical Styling */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Hospital <span className="text-primary-500">Explorer</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Check nearby medical center occupancy, bed capacity, and real-time wait times.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80 md:flex-initial">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search hospitals by name..." 
              className="input-field pl-11 py-2.5 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={requestLocation} 
            className="btn-primary flex items-center gap-1.5 py-2.5 text-sm font-semibold whitespace-nowrap"
          >
            <Navigation size={14} />
            <span>Sync Location</span>
          </button>
        </div>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: Hospital List (G-Maps Place Cards Style) */}
        <div className="lg:col-span-5 flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar order-2 lg:order-1">
          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-card animate-pulse space-y-4">
                  <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  <div className="h-10 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredHospitals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">
              No hospitals found matching your search.
            </div>
          ) : (
            filteredHospitals.map((h) => {
              const crowd = getCrowdDetails(h.crowd_level);
              const isSelected = selectedHospitalId === h.id;
              
              return (
                <div 
                  key={h.id} 
                  id={`hosp-card-${h.id}`}
                  onClick={() => handleSelectHospital(h)}
                  className={`cursor-pointer transition-all duration-300 border rounded-2xl p-5 bg-white flex flex-col justify-between ${
                    isSelected ? 'border-primary-500 ring-2 ring-primary-500/10 shadow-lg' : 'border-slate-100 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h3 className="font-bold text-lg text-slate-800 leading-tight">{h.name}</h3>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold shrink-0">
                        {h.distance}
                      </span>
                    </div>

                    {/* Rating / Review Simulation */}
                    <div className="flex items-center gap-1 text-xs mb-3 text-slate-500">
                      <span className="font-semibold text-slate-800">{h.rating}</span>
                      <div className="flex items-center text-amber-500">
                        <Star size={12} fill="currentColor" />
                      </div>
                      <span>• {crowd.badge} {crowd.text}</span>
                    </div>

                    <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
                      <MapPin size={12} className="text-slate-400" /> {h.address}
                    </p>
                  </div>
                  
                  {/* Bed stats list */}
                  <div className="grid grid-cols-3 gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="text-center">
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Gen Beds</span>
                      <span className="text-sm font-bold text-slate-700">{h.beds} Free</span>
                    </div>
                    <div className="text-center border-x border-slate-200">
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">ICU Beds</span>
                      <span className="text-sm font-bold text-primary-500">{h.icu} Free</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Est. Wait</span>
                      <span className="text-sm font-bold text-primary-500">{h.est_wait_time}m</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <span className="text-green-600 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
                      {h.status}
                    </span>
                    
                    <div className="flex items-center gap-3">
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${h.coords.lat},${h.coords.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-500 hover:text-primary-500 font-semibold flex items-center gap-1"
                      >
                        <ExternalLink size={12} />
                        <span>Directions</span>
                      </a>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/hospital/${h.id}`);
                        }}
                        className="text-primary-500 font-bold flex items-center gap-1 hover:underline hover:text-primary-600"
                      >
                        <span>Join Queue</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Google Maps Container */}
        <div className="lg:col-span-7 bg-white rounded-2xl overflow-hidden h-[400px] lg:h-[600px] border border-slate-100 shadow-sm order-1 lg:order-2 relative">
          {/* Map sync option toggle checkbox overlay */}
          <div className="absolute top-3 right-3 z-10">
            <label className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-xl border border-slate-200/80 shadow-md text-xs font-semibold cursor-pointer select-none text-slate-700 hover:bg-white transition-all">
              <input 
                type="checkbox" 
                checked={searchAsMove} 
                onChange={(e) => {
                  setSearchAsMove(e.target.checked);
                  if (e.target.checked && googleMap.current) {
                    const center = googleMap.current.getCenter();
                    setUserLocation([center.lat(), center.lng()]);
                    setShowSearchThisArea(false);
                  }
                }}
                className="rounded text-primary-500 focus:ring-primary-500 w-4 h-4 border-slate-300 cursor-pointer animate-none"
              />
              <span>Search as map moves</span>
            </label>
          </div>

          {/* Search this area button overlay */}
          {showSearchThisArea && (
            <button
              onClick={() => {
                if (googleMap.current) {
                  const center = googleMap.current.getCenter();
                  setUserLocation([center.lat(), center.lng()]);
                  setShowSearchThisArea(false);
                }
              }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white hover:bg-slate-50 text-primary-600 border border-slate-200 px-4 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-1.5 transition-all duration-200 active:scale-95"
            >
              <Search size={14} className="text-primary-500" />
              <span>Search this area</span>
            </button>
          )}

          <div ref={mapRef} className="w-full h-full z-0" />
        </div>
      </div>
    </div>
  );
};

export default HospitalDiscovery;
