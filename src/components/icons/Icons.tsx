// React import 제거: 최신 JSX 런타임 사용

export const IconRTBLogo = (props: { className?: string }) => (
    <svg
        className={props.className}
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
        className={props.className}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <rect
            x="3"
            y="4"
            width="18"
            height="17"
            rx="2"
            stroke="#374151"
            strokeWidth="1.6"
            fill="none"
        />
        <path
            d="M16 2v4M8 2v4"
            stroke="#374151"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M7 10h1M11 10h1M15 10h1M7 14h1M11 14h1M15 14h1"
            stroke="#374151"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
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
        <g clip-path="url(#clip0_1399_6446)">
            <path
                d="M18 15V18H6V15H4V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V15H18ZM7 9L8.41 10.41L11 7.83V16H13V7.83L15.59 10.41L17 9L12 4L7 9Z"
                fill="#1E2939"
            />
        </g>
        <defs>
            <clipPath id="clip0_1399_6446">
                <rect width="24" height="24" fill="white" />
            </clipPath>
        </defs>
    </svg>
);

export const IconPayment = (props: { className?: string }) => (
    <svg
        className={props.className}
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
            stroke="#9CA3AF"
            strokeWidth="1.2"
            fill="none"
        />
        <rect x="3.5" y="8.5" width="6" height="2" rx="0.5" fill="#9CA3AF" />
    </svg>
);

export const IconCardAlt = (props: { className?: string }) => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <g clip-path="url(#clip0_468_4397)">
            <path
                d="M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z"
                fill="#1E2939"
            />
        </g>
        <defs>
            <clipPath id="clip0_468_4397">
                <rect width="24" height="24" fill="white" />
            </clipPath>
        </defs>
    </svg>
);

export const IconCar = (props: { className?: string }) => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M8 6.4L5 3.4L6.4 2L9.4 5L8 6.4ZM16 6.4L14.6 5L17.6 2L19 3.4L16 6.4ZM11 5V0H13V5H11ZM4 24C3.71667 24 3.47933 23.904 3.288 23.712C3.096 23.5207 3 23.2833 3 23V15L5.1 9C5.2 8.7 5.37933 8.45833 5.638 8.275C5.896 8.09167 6.18333 8 6.5 8H17.5C17.8167 8 18.1043 8.09167 18.363 8.275C18.621 8.45833 18.8 8.7 18.9 9L21 15V23C21 23.2833 20.904 23.5207 20.712 23.712C20.5207 23.904 20.2833 24 20 24H19C18.7167 24 18.4793 23.904 18.288 23.712C18.096 23.5207 18 23.2833 18 23V22H6V23C6 23.2833 5.90433 23.5207 5.713 23.712C5.521 23.904 5.28333 24 5 24H4ZM5.8 13H18.2L17.15 10H6.85L5.8 13ZM7.5 19C7.91667 19 8.27067 18.854 8.562 18.562C8.854 18.2707 9 17.9167 9 17.5C9 17.0833 8.854 16.7293 8.562 16.438C8.27067 16.146 7.91667 16 7.5 16C7.08333 16 6.72933 16.146 6.438 16.438C6.146 16.7293 6 17.0833 6 17.5C6 17.9167 6.146 18.2707 6.438 18.562C6.72933 18.854 7.08333 19 7.5 19ZM16.5 19C16.9167 19 17.2707 18.854 17.562 18.562C17.854 18.2707 18 17.9167 18 17.5C18 17.0833 17.854 16.7293 17.562 16.438C17.2707 16.146 16.9167 16 16.5 16C16.0833 16 15.7293 16.146 15.438 16.438C15.146 16.7293 15 17.0833 15 17.5C15 17.9167 15.146 18.2707 15.438 18.562C15.7293 18.854 16.0833 19 16.5 19ZM5 20H19V15H5V20Z"
            fill="#1E2939"
        />
    </svg>
);
