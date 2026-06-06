const iconProps = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

function Sun({ partial = false }) {
  return (
    <svg {...iconProps}>
      <circle cx="24" cy="24" r="8" fill="currentColor" opacity="0.14" />
      <path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M37.4 10.6l-4.2 4.2M14.8 33.2l-4.2 4.2" />
      {partial && <path d="M8 36c4-7 10-10 18-10 6 0 11 2 15 6" />}
    </svg>
  );
}

function Shade({ leaves = 1 }) {
  return (
    <svg {...iconProps}>
      <path d="M10 35c9-22 22-24 29-23-1 8-6 20-27 25" fill="currentColor" opacity="0.12" />
      <path d="M10 35c9-22 22-24 29-23-1 8-6 20-27 25" />
      <path d="M13 34c9-7 16-12 25-21" />
      {leaves > 1 && <path d="M10 25c2-8 8-13 17-15" />}
    </svg>
  );
}

function Water({ drops = 1 }) {
  return (
    <svg {...iconProps}>
      <path d="M24 7s-10 12-10 21a10 10 0 0 0 20 0C34 19 24 7 24 7z" fill="currentColor" opacity="0.12" />
      <path d="M24 7s-10 12-10 21a10 10 0 0 0 20 0C34 19 24 7 24 7z" />
      {drops > 1 && <path d="M10 16s-4 5-4 9a4 4 0 0 0 8 0c0-4-4-9-4-9zM38 16s-4 5-4 9a4 4 0 0 0 8 0c0-4-4-9-4-9z" />}
      {drops === 0 && <path d="M10 38h28" />}
    </svg>
  );
}

function Soil({ type = 'well_draining' }) {
  return (
    <svg {...iconProps}>
      <path d="M8 34h32M11 25h26M15 16h18" />
      {type === 'well_draining' && <path d="M17 38l4 5M25 38l4 5M33 38l4 5" />}
      {type === 'sandy' && <path d="M13 39h.1M20 41h.1M27 39h.1M35 41h.1" />}
      {type === 'loamy' && <path d="M15 25c3-5 7-7 12-7 3 0 6 1 9 3" />}
      {type === 'clay' && <path d="M11 34c7 5 19 5 26 0" />}
    </svg>
  );
}

function Paw({ alert = false }) {
  return (
    <svg {...iconProps}>
      <circle cx="16" cy="17" r="4" fill="currentColor" opacity="0.12" />
      <circle cx="24" cy="13" r="4" fill="currentColor" opacity="0.12" />
      <circle cx="32" cy="17" r="4" fill="currentColor" opacity="0.12" />
      <path d="M17 31c0-5 3-9 7-9s7 4 7 9c0 4-3 6-7 6s-7-2-7-6z" fill="currentColor" opacity="0.12" />
      <circle cx="16" cy="17" r="4" />
      <circle cx="24" cy="13" r="4" />
      <circle cx="32" cy="17" r="4" />
      <path d="M17 31c0-5 3-9 7-9s7 4 7 9c0 4-3 6-7 6s-7-2-7-6z" />
      {alert && <path d="M39 9l-8 8M31 9l8 8" />}
    </svg>
  );
}

function California() {
  return (
    <svg {...iconProps}>
      <path d="M16 7l11 2 3 9 6 6-4 17H18l-3-9 3-9-4-7 2-9z" fill="currentColor" opacity="0.12" />
      <path d="M16 7l11 2 3 9 6 6-4 17H18l-3-9 3-9-4-7 2-9z" />
      <path d="M23 18v14M17 25h13" />
    </svg>
  );
}

function Sprout() {
  return (
    <svg {...iconProps}>
      <path d="M24 40V19" />
      <path d="M24 22c-8 0-13-5-14-13 8 0 13 5 14 13z" fill="currentColor" opacity="0.12" />
      <path d="M24 22c-8 0-13-5-14-13 8 0 13 5 14 13z" />
      <path d="M24 27c8 0 13-5 14-13-8 0-13 5-14 13z" fill="currentColor" opacity="0.12" />
      <path d="M24 27c8 0 13-5 14-13-8 0-13 5-14 13z" />
      <path d="M13 40h22" />
    </svg>
  );
}

const icons = {
  full_sun: <Sun />,
  partial_sun: <Sun partial />,
  partial_shade: <Shade leaves={2} />,
  shade: <Shade />,
  dry: <Water drops={0} />,
  moderate_water: <Water />,
  wet: <Water drops={3} />,
  well_draining_soil: <Soil />,
  sandy_soil: <Soil type="sandy" />,
  loamy_soil: <Soil type="loamy" />,
  clay_tolerant: <Soil type="clay" />,
  pet_safe: <Paw />,
  pet_caution: <Paw alert />,
  toxic_pets: <Paw alert />,
  california_suitable: <California />,
  beginner_friendly: <Sprout />,
};

export function CareIcon({ name, className = 'h-5 w-5' }) {
  return <span className={className}>{icons[name] || <Sprout />}</span>;
}
