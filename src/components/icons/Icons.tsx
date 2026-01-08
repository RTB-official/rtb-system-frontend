// React import 제거: 최신 JSX 런타임 사용

export const IconRTBLogo = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <rect x="2" y="4" width="20" height="16" rx="3" fill="#111827" />
        <path
            d="M7 8H17"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M7 12H13"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export const IconCalendar = (props: { className?: string }) => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M8 18C7.71667 18 7.479 17.904 7.287 17.712C7.09567 17.5207 7 17.2833 7 17C7 16.7167 7.09567 16.4793 7.287 16.288C7.479 16.096 7.71667 16 8 16C8.28333 16 8.521 16.096 8.713 16.288C8.90433 16.4793 9 16.7167 9 17C9 17.2833 8.90433 17.5207 8.713 17.712C8.521 17.904 8.28333 18 8 18ZM8 14C7.71667 14 7.479 13.904 7.287 13.712C7.09567 13.5207 7 13.2833 7 13C7 12.7167 7.09567 12.479 7.287 12.287C7.479 12.0957 7.71667 12 8 12C8.28333 12 8.521 12.0957 8.713 12.287C8.90433 12.479 9 12.7167 9 13C9 13.2833 8.90433 13.5207 8.713 13.712C8.521 13.904 8.28333 14 8 14ZM12 18C11.7167 18 11.4793 17.904 11.288 17.712C11.096 17.5207 11 17.2833 11 17C11 16.7167 11.096 16.4793 11.288 16.288C11.4793 16.096 11.7167 16 12 16C12.2833 16 12.521 16.096 12.713 16.288C12.9043 16.4793 13 16.7167 13 17C13 17.2833 12.9043 17.5207 12.713 17.712C12.521 17.904 12.2833 18 12 18ZM12 14C11.7167 14 11.4793 13.904 11.288 13.712C11.096 13.5207 11 13.2833 11 13C11 12.7167 11.096 12.479 11.288 12.287C11.4793 12.0957 11.7167 12 12 12C12.2833 12 12.521 12.0957 12.713 12.287C12.9043 12.479 13 12.7167 13 13C13 13.2833 12.9043 13.5207 12.713 13.712C12.521 13.904 12.2833 14 12 14ZM16 18C15.7167 18 15.4793 17.904 15.288 17.712C15.096 17.5207 15 17.2833 15 17C15 16.7167 15.096 16.4793 15.288 16.288C15.4793 16.096 15.7167 16 16 16C16.2833 16 16.5207 16.096 16.712 16.288C16.904 16.4793 17 16.7167 17 17C17 17.2833 16.904 17.5207 16.712 17.712C16.5207 17.904 16.2833 18 16 18ZM16 14C15.7167 14 15.4793 13.904 15.288 13.712C15.096 13.5207 15 13.2833 15 13C15 12.7167 15.096 12.479 15.288 12.287C15.4793 12.0957 15.7167 12 16 12C16.2833 12 16.5207 12.0957 16.712 12.287C16.904 12.479 17 12.7167 17 13C17 13.2833 16.904 13.5207 16.712 13.712C16.5207 13.904 16.2833 14 16 14ZM5 22C4.45 22 3.979 21.8043 3.587 21.413C3.19567 21.021 3 20.55 3 20V6C3 5.45 3.19567 4.97933 3.587 4.588C3.979 4.196 4.45 4 5 4H6V2H8V4H16V2H18V4H19C19.55 4 20.021 4.196 20.413 4.588C20.8043 4.97933 21 5.45 21 6V20C21 20.55 20.8043 21.021 20.413 21.413C20.021 21.8043 19.55 22 19 22H5ZM5 20H19V10H5V20ZM5 8H19V6H5V8Z"
            fill="currentColor"
        />
    </svg>
);

export const IconUpload = (props: { className?: string }) => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <g clip-path="url(#clip0_1399_4704)">
            <path
                d="M18 15V18H6V15H4V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V15H18ZM7 9L8.41 10.41L11 7.83V16H13V7.83L15.59 10.41L17 9L12 4L7 9Z"
                fill="#1E2939"
            />
        </g>
        <defs>
            <clipPath id="clip0_1399_4704">
                <rect width="24" height="24" fill="white" />
            </clipPath>
        </defs>
    </svg>
);

export const IconPayment = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <rect
            x="2"
            y="5"
            width="20"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
        />
        <rect
            x="3.5"
            y="8.5"
            width="6"
            height="2"
            rx="0.5"
            fill="currentColor"
        />
    </svg>
);

export const IconCard = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z"
            fill="currentColor"
        />
    </svg>
);

export const IconCar = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M8 6.4L5 3.4L6.4 2L9.4 5L8 6.4ZM16 6.4L14.6 5L17.6 2L19 3.4L16 6.4ZM11 5V0H13V5H11ZM4 24C3.71667 24 3.47933 23.904 3.288 23.712C3.096 23.5207 3 23.2833 3 23V15L5.1 9C5.2 8.7 5.37933 8.45833 5.638 8.275C5.896 8.09167 6.18333 8 6.5 8H17.5C17.8167 8 18.1043 8.09167 18.363 8.275C18.621 8.45833 18.8 8.7 18.9 9L21 15V23C21 23.2833 20.904 23.5207 20.712 23.712C20.5207 23.904 20.2833 24 20 24H19C18.7167 24 18.4793 23.904 18.288 23.712C18.096 23.5207 18 23.2833 18 23V22H6V23C6 23.2833 5.90433 23.5207 5.713 23.712C5.521 23.904 5.28333 24 5 24H4ZM5.8 13H18.2L17.15 10H6.85L5.8 13ZM7.5 19C7.91667 19 8.27067 18.854 8.562 18.562C8.854 18.2707 9 17.9167 9 17.5C9 17.0833 8.854 16.7293 8.562 16.438C8.27067 16.146 7.91667 16 7.5 16C7.08333 16 6.72933 16.146 6.438 16.438C6.146 16.7293 6 17.0833 6 17.5C6 17.9167 6.146 18.2707 6.438 18.562C6.72933 18.854 7.08333 19 7.5 19ZM16.5 19C16.9167 19 17.2707 18.854 17.562 18.562C17.854 18.2707 18 17.9167 18 17.5C18 17.0833 17.854 16.7293 17.562 16.438C17.2707 16.146 16.9167 16 16.5 16C16.0833 16 15.7293 16.146 15.438 16.438C15.146 16.7293 15 17.0833 15 17.5C15 17.9167 15.146 18.2707 15.438 18.562C15.7293 18.854 16.0833 19 16.5 19ZM5 20H19V15H5V20Z"
            fill="currentColor"
        />
    </svg>
);

export const IconClock = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
        />
        <path
            d="M12 6v6l4 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export const IconEdit = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <path d="M4 21v-3.5L17.5 4.5a2 2 0 012.8 0l0 0a2 2 0 010 2.8L7.5 20.5H4z" />
    </svg>
);

export const IconTrash = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <path d="M3 6h18" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4h6v2" />
    </svg>
);

export const IconDownload = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <path d="M7 10l5 5 5-5" />
        <path d="M12 15V3" />
    </svg>
);

export const IconLock = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
);

export const IconLogout = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
    </svg>
);

export const IconStar = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
);

export const IconChevronLeft = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M15 18l-6-6 6-6" />
    </svg>
);

export const IconChevronRight = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M9 18l6-6-6-6" />
    </svg>
);

export const IconMenu = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
    >
        <path d="M4 6H20M4 12H20M4 18H20" />
    </svg>
);

export const IconPerson = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

export const IconHome = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z"
            fill="currentColor"
        />
    </svg>
);

export const IconReport = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"
            fill="currentColor"
        />
    </svg>
);

export const IconWorkload = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z"
            fill="currentColor"
        />
    </svg>
);

export const IconVacation = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M19.6 20.9996L13.25 14.6496L14.65 13.2496L21 19.5996L19.6 20.9996ZM5.95 20.2996C4.95 19.2996 4.20833 18.1746 3.725 16.9246C3.24167 15.6746 3 14.3996 3 13.0996C3 11.7996 3.24167 10.5329 3.725 9.29961C4.20833 8.06628 4.95 6.94961 5.95 5.94961C6.95 4.94961 8.07083 4.20378 9.3125 3.71211C10.5542 3.22044 11.825 2.97461 13.125 2.97461C14.425 2.97461 15.6958 3.22044 16.9375 3.71211C18.1792 4.20378 19.3 4.94961 20.3 5.94961L5.95 20.2996ZM6.15 17.2496L7.5 15.8996C7.23333 15.5496 6.97917 15.1913 6.7375 14.8246C6.49583 14.4579 6.275 14.0913 6.075 13.7246C5.875 13.3579 5.7 12.9913 5.55 12.6246C5.4 12.2579 5.26667 11.8996 5.15 11.5496C4.96667 12.5329 4.95417 13.5163 5.1125 14.4996C5.27083 15.4829 5.61667 16.3996 6.15 17.2496ZM8.95 14.4996L14.5 8.89961C13.7833 8.34961 13.0625 7.90378 12.3375 7.56211C11.6125 7.22044 10.9333 6.98711 10.3 6.86211C9.66667 6.73711 9.09583 6.71628 8.5875 6.79961C8.07917 6.88294 7.68333 7.06628 7.4 7.34961C7.11667 7.64961 6.93333 8.05378 6.85 8.56211C6.76667 9.07044 6.7875 9.64544 6.9125 10.2871C7.0375 10.9288 7.27083 11.6079 7.6125 12.3246C7.95417 13.0413 8.4 13.7663 8.95 14.4996ZM15.9 7.49961L17.3 6.14961C16.4167 5.61628 15.4833 5.26628 14.5 5.09961C13.5167 4.93294 12.5333 4.94961 11.55 5.14961C11.9167 5.26628 12.2833 5.39961 12.65 5.54961C13.0167 5.69961 13.3833 5.87044 13.75 6.06211C14.1167 6.25378 14.4792 6.47044 14.8375 6.71211C15.1958 6.95378 15.55 7.21628 15.9 7.49961Z"
            fill="currentColor"
        />
    </svg>
);

export const IconMembers = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H23V16.5C23 14.17 18.33 13 16 13Z"
            fill="currentColor"
        />
    </svg>
);

export const IconNotifications = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.37 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.64 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z"
            fill="currentColor"
        />
    </svg>
);

export const IconClose = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
            fill="currentColor"
        />
    </svg>
);

export const IconCheck = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M20 6L9 17l-5-5" />
    </svg>
);

export const IconArrowBack = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
            fill="currentColor"
        />
    </svg>
);

export const IconPlus = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <g clipPath="url(#clip0_plus)">
            <path
                d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"
                fill="currentColor"
            />
        </g>
        <defs>
            <clipPath id="clip0_plus">
                <rect width="24" height="24" fill="white" />
            </clipPath>
        </defs>
    </svg>
);

export const IconMore = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M6 10C4.9 10 4 10.9 4 12C4 13.1 4.9 14 6 14C7.1 14 8 13.1 8 12C8 10.9 7.1 10 6 10ZM18 10C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14C19.1 14 20 13.1 20 12C20 10.9 19.1 10 18 10ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"
            fill="currentColor"
        />
    </svg>
);
