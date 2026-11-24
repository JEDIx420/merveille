-- Frozen drawing content cannot be replaced after submission.
CREATE TRIGGER immutable_drawing_version BEFORE UPDATE OF file_id,cad_file_id,submission_note ON drawing_versions WHEN OLD.status!='DRAFT' BEGIN SELECT RAISE(ABORT,'IMMUTABLE_DRAWING_VERSION'); END;
CREATE TRIGGER immutable_review_requirements BEFORE UPDATE OF version_id,consultant_user_id,is_required ON drawing_reviews WHEN (SELECT status FROM drawing_versions WHERE id=OLD.version_id)!='DRAFT' BEGIN SELECT RAISE(ABORT,'IMMUTABLE_REVIEW_REQUIREMENTS'); END;
CREATE TRIGGER immutable_update_content BEFORE UPDATE OF title,body_text,observed_date ON update_versions WHEN OLD.status!='DRAFT' BEGIN SELECT RAISE(ABORT,'IMMUTABLE_UPDATE_VERSION'); END;
