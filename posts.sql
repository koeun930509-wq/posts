-- ============================================================
-- 게시판(posts) 테이블 생성 스크립트
-- 대상: Supabase (PostgreSQL)
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    writer      VARCHAR(50)  NOT NULL,
    content     TEXT         NOT NULL,
    view_count  INTEGER      NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 컬럼 설명 (COMMENT)
-- ============================================================

COMMENT ON TABLE  posts             IS '게시판 게시글 테이블';
COMMENT ON COLUMN posts.id          IS '게시글 고유 식별자 (자동 증가, 기본 키)';
COMMENT ON COLUMN posts.title       IS '게시글 제목 (최대 200자, 필수)';
COMMENT ON COLUMN posts.writer      IS '작성자 이름 (최대 50자, 필수)';
COMMENT ON COLUMN posts.content     IS '게시글 본문 내용 (필수)';
COMMENT ON COLUMN posts.view_count  IS '조회수 (0 이상, 기본값 0)';
COMMENT ON COLUMN posts.created_at  IS '게시글 생성 일시 (기본값: 현재 시각)';
COMMENT ON COLUMN posts.updated_at  IS '게시글 수정 일시 (기본값: 현재 시각)';

-- ============================================================
-- RLS(Row Level Security) 정책
-- 로그인 없이 누구나 조회/작성 가능한 게시판이므로
-- RLS를 켜고 공개 접근 정책을 명시적으로 부여
-- ============================================================

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON posts -- 글 읽기
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON posts -- 글 쓰기
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON posts -- 글 수정
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete" ON posts -- 글 삭제
    FOR DELETE USING (true);

-- ============================================================
-- 댓글(comments) 테이블 생성 스크립트
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id     BIGINT       NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    writer      VARCHAR(50)  NOT NULL,
    content     TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 컬럼 설명 (COMMENT)

COMMENT ON TABLE  comments             IS '게시글 댓글 테이블';
COMMENT ON COLUMN comments.id          IS '댓글 고유 식별자 (자동 증가, 기본 키)';
COMMENT ON COLUMN comments.post_id     IS '댓글이 속한 게시글 id (posts.id 참조, 게시글 삭제 시 댓글도 함께 삭제)';
COMMENT ON COLUMN comments.writer      IS '댓글 작성자 이름 (최대 50자, 필수)';
COMMENT ON COLUMN comments.content     IS '댓글 내용 (필수)';
COMMENT ON COLUMN comments.created_at  IS '댓글 생성 일시 (기본값: 현재 시각)';
COMMENT ON COLUMN comments.updated_at  IS '댓글 수정 일시 (기본값: 현재 시각)';

-- ============================================================
-- RLS(Row Level Security) 정책
-- 로그인 없이 누구나 조회/작성 가능한 댓글이므로
-- RLS를 켜고 공개 접근 정책을 명시적으로 부여
-- ============================================================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON comments -- 댓글 조회
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON comments -- 댓글 등록
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON comments -- 댓글 수정
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete" ON comments -- 댓글 삭제
    FOR DELETE USING (true);

-- ============================================================
-- Storage: postsImg 버킷 (게시글 이미지 업로드용)
-- 이미 대시보드에서 postsImg 버킷을 만들어 두었다면 버킷 생성 부분은
-- "이미 존재함" 처리되어 무시되고, 아래 정책만 새로 적용됩니다.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('postsImg', 'postsImg', true)
ON CONFLICT (id) DO NOTHING;

-- 버킷이 이미 존재해서 위 INSERT가 무시된 경우를 대비해,
-- 업로드에 사용할 이미지 mime type을 명시적으로 허용 (image/jpeg 업로드 400 오류 방지)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'postsImg';

-- storage.objects는 Supabase가 기본 제공하는 테이블로, 버킷이 public이어도
-- 업로드(insert)/수정/삭제는 정책이 없으면 막히므로 postsImg 버킷 한정으로 공개 정책을 부여

CREATE POLICY "Public read postsImg" ON storage.objects -- 이미지 조회
    FOR SELECT USING (bucket_id = 'postsImg');

CREATE POLICY "Public upload postsImg" ON storage.objects -- 이미지 업로드
    FOR INSERT WITH CHECK (bucket_id = 'postsImg');

CREATE POLICY "Public update postsImg" ON storage.objects -- 이미지 교체
    FOR UPDATE USING (bucket_id = 'postsImg') WITH CHECK (bucket_id = 'postsImg');

CREATE POLICY "Public delete postsImg" ON storage.objects -- 이미지 삭제
    FOR DELETE USING (bucket_id = 'postsImg');
